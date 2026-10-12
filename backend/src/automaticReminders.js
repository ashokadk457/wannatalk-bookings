import { pool } from './db.js';
import { sendCommunicationEmail } from './mail.js';
import { renderAutomatic } from './automaticReminderContent.js';

// The session lock serializes workers across processes; durable claims prevent repeated email.
export async function runAutomaticReminders({ sendEmail = sendCommunicationEmail, database = pool } = {}) {
  const client = await database.connect();
  let locked = false;
  const timezone = process.env.APPOINTMENT_TIMEZONE || 'Africa/Johannesburg';
  try {
    locked = (await client.query('SELECT pg_try_advisory_lock(481932, 12) AS locked')).rows[0].locked;
    if (!locked) return;
    const due = await client.query(`SELECT a.id, a.patient_id, a.provider_id, a.appointment_date::text,
      a.appointment_time::text, (a.appointment_time + a.duration_minutes * interval '1 minute')::time::text AS end_time,
      a.mode, ((a.appointment_date + a.appointment_time) AT TIME ZONE $1)::text AS starts_at,
      u.full_name AS patient_name, u.email AS patient_email, pu.full_name AS provider_name, pu.email AS provider_email,
      s.language, s.templates, offset_minutes
      FROM appointments a JOIN providers p ON p.id=a.provider_id JOIN app_users pu ON pu.id=p.user_id
      JOIN patients pat ON pat.id=a.patient_id JOIN app_users u ON u.id=pat.user_id
      JOIN provider_reminder_settings s ON s.provider_id=p.id CROSS JOIN LATERAL unnest(s.offsets) AS offsets(offset_minutes)
      WHERE s.enabled AND pu.is_active AND u.is_active AND a.status IN ('Booked','Confirmed')
      AND (a.appointment_date + a.appointment_time) AT TIME ZONE $1 > now()
      AND (a.appointment_date + a.appointment_time) AT TIME ZONE $1 - offset_minutes * interval '1 minute' BETWEEN now()-interval '5 minutes' AND now()
      AND (a.appointment_date + a.appointment_time) AT TIME ZONE $1 - offset_minutes * interval '1 minute' >= s.enabled_at
      AND EXISTS (SELECT 1 FROM (VALUES ('patient'),('provider')) AS recipients(kind)
        WHERE NOT EXISTS (SELECT 1 FROM automatic_reminder_deliveries d WHERE d.appointment_id=a.id AND d.patient_id=a.patient_id
          AND d.starts_at=(a.appointment_date+a.appointment_time) AT TIME ZONE $1 AND d.offset_minutes=offsets.offset_minutes AND d.recipient_kind=recipients.kind))
      ORDER BY a.appointment_date, a.appointment_time LIMIT 100`, [timezone]);
    for (const appointment of due.rows) for (const kind of ['patient','provider']) {
      // Recheck immediately before claiming: cancellation, time changes and disabled settings suppress email.
      const valid = await client.query(`SELECT 1 FROM appointments a JOIN provider_reminder_settings s ON s.provider_id=a.provider_id
        JOIN providers p ON p.id=a.provider_id JOIN app_users pu ON pu.id=p.user_id
        JOIN patients pat ON pat.id=a.patient_id JOIN app_users u ON u.id=pat.user_id
        WHERE a.id=$1 AND a.patient_id=$2 AND a.provider_id=$3 AND s.enabled AND $4=ANY(s.offsets)
        AND s.language=$5 AND s.templates=$6::jsonb AND pu.is_active AND u.is_active
        AND a.status IN ('Booked','Confirmed') AND (a.appointment_date+a.appointment_time) AT TIME ZONE $7=$8
        AND (a.appointment_date+a.appointment_time) AT TIME ZONE $7>now()`, [appointment.id,appointment.patient_id,appointment.provider_id,appointment.offset_minutes,appointment.language,JSON.stringify(appointment.templates),timezone,appointment.starts_at]);
      if (!valid.rowCount) continue;
      const fields = { ...appointment, recipient_name:appointment[`${kind}_name`], start_time:appointment.appointment_time.slice(0,5), end_time:appointment.end_time.slice(0,5) };
      const template = appointment.templates[appointment.language][kind];
      const subject = renderAutomatic(template.subject, fields);
      const message = renderAutomatic(template.message, fields);
      const recipient = appointment[`${kind}_email`] || '';
      const claim = await client.query(`INSERT INTO automatic_reminder_deliveries
        (provider_id,appointment_id,patient_id,starts_at,offset_minutes,recipient_kind,recipient,subject,message,status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'sending') ON CONFLICT DO NOTHING RETURNING id`,
      [appointment.provider_id,appointment.id,appointment.patient_id,appointment.starts_at,appointment.offset_minutes,kind,recipient,subject,message]);
      if (!claim.rows[0]) continue;
      const id=claim.rows[0].id;
      try {
        if (!recipient) throw new Error('Recipient has no email address');
        await sendEmail({email:recipient,fullName:fields.recipient_name,subject,message});
        await client.query("UPDATE automatic_reminder_deliveries SET status='sent',sent_at=now() WHERE id=$1",[id]);
      } catch(error) {
        await client.query("UPDATE automatic_reminder_deliveries SET status='failed',error_message=$2 WHERE id=$1",[id,String(error.message).slice(0,500)]);
      }
    }
  } finally {
    try { if (locked) await client.query('SELECT pg_advisory_unlock(481932,12)'); }
    finally { client.release(); }
  }
}

export function startAutomaticReminders() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runAutomaticReminders(); }
    catch(error) { console.error('Automatic reminder worker:',error.message); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 30000);
  void tick();
  return () => clearInterval(timer);
}
