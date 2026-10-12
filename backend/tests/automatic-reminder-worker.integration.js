// Explicit DB integration check: isolated temporary tables, rolled back; SMTP is mocked.
import 'dotenv/config';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pool} from '../src/db.js';
import {runAutomaticReminders} from '../src/automaticReminders.js';
import {defaultAutomaticTemplates} from '../src/automaticReminderContent.js';
const client=await pool.connect();
const emails=[];
const database={connect:async()=>({query:client.query.bind(client),release(){}})};
const sendEmail=async email=>emails.push(email);
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL search_path=pg_temp,public');
  await client.query(`CREATE TEMP TABLE app_users(id uuid PRIMARY KEY, full_name text, email text, is_active boolean);
    CREATE TEMP TABLE providers(id uuid PRIMARY KEY,user_id uuid);
    CREATE TEMP TABLE patients(id uuid PRIMARY KEY,user_id uuid);
    CREATE TEMP TABLE appointments(id uuid PRIMARY KEY,provider_id uuid,patient_id uuid,appointment_date date,appointment_time time,duration_minutes integer,mode text,status text);
    INSERT INTO app_users VALUES ('00000000-0000-0000-0000-000000000001','Provider QA','provider@example.invalid',true),('00000000-0000-0000-0000-000000000002','Patient QA','patient@example.invalid',true);
    INSERT INTO providers VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001');
    INSERT INTO patients VALUES ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002');`);
  const sql=(await readFile(new URL('../../migrations/012_automatic_reminders.sql',import.meta.url),'utf8')).replaceAll('CREATE TABLE IF NOT EXISTS','CREATE TEMP TABLE');
  await client.query(sql);
  await client.query(`INSERT INTO provider_reminder_settings(provider_id,enabled,offsets,language,templates,enabled_at)
    VALUES ('00000000-0000-0000-0000-000000000003',true,ARRAY[30],'en',$1::jsonb,now()-interval '10 minutes')`,[JSON.stringify(defaultAutomaticTemplates)]);
  await client.query(`INSERT INTO appointments SELECT '00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004',
    ((now()+interval '29 minutes') AT TIME ZONE 'Africa/Johannesburg')::date,((now()+interval '29 minutes') AT TIME ZONE 'Africa/Johannesburg')::time,60,'Online','Booked'`);
  await runAutomaticReminders({database,sendEmail});
  assert.equal(emails.length,2);
  assert.deepEqual(emails.map(e=>e.email),['patient@example.invalid','provider@example.invalid']);
  await runAutomaticReminders({database,sendEmail});assert.equal(emails.length,2,'Second tick must not repeat email');
  await client.query("UPDATE appointments SET appointment_time=appointment_time-interval '1 minute',status='Cancelled'");
  await runAutomaticReminders({database,sendEmail});assert.equal(emails.length,2,'Cancelled appointment suppressed');
  await client.query("UPDATE appointments SET status='Confirmed'; UPDATE provider_reminder_settings SET enabled=false");
  await runAutomaticReminders({database,sendEmail});assert.equal(emails.length,2,'Disabled settings suppressed');
  await client.query("UPDATE provider_reminder_settings SET enabled=true, offsets=ARRAY[15]");
  await runAutomaticReminders({database,sendEmail});assert.equal(emails.length,2,'Unselected 30-minute offset suppressed');
  await client.query("UPDATE provider_reminder_settings SET offsets=ARRAY[30]");
  await runAutomaticReminders({database,sendEmail});assert.equal(emails.length,4,'Rescheduled appointment receives reminders at its new time');
  await client.query("UPDATE appointments SET appointment_time=appointment_time-interval '1 minute'");
  await runAutomaticReminders({database,sendEmail:async email=>{if(email.email.startsWith('patient')) throw new Error('Mock SMTP failure');emails.push(email);}});
  const statuses=await client.query("SELECT status,count(*)::integer FROM automatic_reminder_deliveries GROUP BY status");
  assert.equal(statuses.rows.find(r=>r.status==='failed')?.count,1);
  assert.equal(statuses.rows.find(r=>r.status==='sent')?.count,5);
  for (const [offset,interval] of [[15,'14 minutes'],[1440,'23 hours 59 minutes']]) {
    await client.query('UPDATE provider_reminder_settings SET offsets=ARRAY[$1]::integer[]',[offset]);
    await client.query(`UPDATE appointments SET appointment_date=((now()+$1::interval) AT TIME ZONE 'Africa/Johannesburg')::date,
      appointment_time=((now()+$1::interval) AT TIME ZONE 'Africa/Johannesburg')::time`,[interval]);
    const before=emails.length;
    await runAutomaticReminders({database,sendEmail});assert.equal(emails.length,before+2,`${offset}-minute timing sends to both recipients`);
  }
  console.log('Worker integration passed: both recipients, duplicate suppression, cancellation, disabled settings, offset selection, rescheduling and isolated delivery failures. No real email sent.');
} finally {
  await client.query('ROLLBACK');
  await client.query('SELECT pg_advisory_unlock(481932,12)');
  client.release();await pool.end();
}
