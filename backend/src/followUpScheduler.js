import { pool, query } from './db.js';
import { cleanChannels, sendPatientCommunication } from './communications.js';

const MAX_ATTEMPTS = 3;

const renderApplicationMessage=(template,row)=>String(template||'')
  .replaceAll('{patient}',row.patient_name||'')
  .replaceAll('{provider}',row.provider_name||'')
  .replaceAll('{appointment_date}',row.appointment_date||'');

export async function runApplicationFollowUps({ database = pool, sendCommunication = sendPatientCommunication } = {}) {
  const client=await database.connect();let locked=false;
  try {
    locked=(await client.query('SELECT pg_try_advisory_lock(481932, 14) AS locked')).rows[0].locked;
    if(!locked)return;
    const timezone=process.env.APPOINTMENT_TIMEZONE||'Africa/Johannesburg';
    const candidates=await client.query(`WITH configured AS (
      SELECT a.id appointment_id,a.patient_id,a.provider_id,a.appointment_date,a.appointment_time,a.duration_minutes,
        pu.full_name patient_name,pru.full_name provider_name,s.*,series.send_number,
        GREATEST(
          (a.appointment_date+a.appointment_time+a.duration_minutes*interval '1 minute') AT TIME ZONE $1,
          (a.appointment_date+s.send_time) AT TIME ZONE $1
            + make_interval(months=>CASE WHEN s.first_send_after_unit='months' THEN s.first_send_after_value ELSE 0 END,
                            weeks=>CASE WHEN s.first_send_after_unit='weeks' THEN s.first_send_after_value ELSE 0 END,
                            days=>CASE WHEN s.first_send_after_unit='days' THEN s.first_send_after_value ELSE 0 END)
        ) first_scheduled
      FROM application_follow_up_settings s JOIN appointments a ON s.enabled AND a.status='Completed'
      JOIN patients p ON p.id=a.patient_id JOIN app_users pu ON pu.id=p.user_id AND pu.is_active
      JOIN providers pr ON pr.id=a.provider_id JOIN app_users pru ON pru.id=pr.user_id AND pru.is_active
      CROSS JOIN LATERAL generate_series(1,s.max_sends) series(send_number)
      WHERE s.singleton=true AND a.appointment_date>=s.applies_to_appointments_from
    ), due AS (
      SELECT configured.*,
        first_scheduled + (send_number-1)*make_interval(
          months=>CASE WHEN repeat_every_unit='months' THEN repeat_every_value ELSE 0 END,
          weeks=>CASE WHEN repeat_every_unit='weeks' THEN repeat_every_value ELSE 0 END,
          days=>CASE WHEN repeat_every_unit='days' THEN repeat_every_value ELSE 0 END) scheduled_for
      FROM configured
    )
    SELECT due.* FROM due LEFT JOIN application_follow_up_deliveries d ON d.appointment_id=due.appointment_id AND d.send_number=due.send_number
      WHERE due.scheduled_for<=now()
        AND (d.id IS NULL OR (d.status='failed' AND d.attempts<$2 AND d.updated_at<now()-interval '1 minute'))
        AND (due.send_number=1 OR EXISTS(SELECT 1 FROM application_follow_up_deliveries previous
          WHERE previous.appointment_id=due.appointment_id AND previous.send_number=due.send_number-1 AND previous.status='sent'
          AND previous.sent_at+make_interval(
            months=>CASE WHEN due.repeat_every_unit='months' THEN due.repeat_every_value ELSE 0 END,
            weeks=>CASE WHEN due.repeat_every_unit='weeks' THEN due.repeat_every_value ELSE 0 END,
            days=>CASE WHEN due.repeat_every_unit='days' THEN due.repeat_every_value ELSE 0 END)<=now()))
      ORDER BY due.scheduled_for LIMIT 25`,[timezone,MAX_ATTEMPTS]);
    for(const row of candidates.rows){
      const claim=await client.query(`INSERT INTO application_follow_up_deliveries(appointment_id,patient_id,provider_id,send_number,scheduled_for,status,attempts)
        VALUES($1,$2,$3,$4,$5,'sending',1) ON CONFLICT(appointment_id,send_number) DO UPDATE SET status='sending',attempts=application_follow_up_deliveries.attempts+1,updated_at=now(),error_message=NULL
        WHERE application_follow_up_deliveries.status='failed' AND application_follow_up_deliveries.attempts<$6 RETURNING *`,
        [row.appointment_id,row.patient_id,row.provider_id,row.send_number,row.scheduled_for,MAX_ATTEMPTS]);
      if(!claim.rows[0])continue;
      const prior=Array.isArray(claim.rows[0].delivery_summary)?claim.rows[0].delivery_summary:[];
      const sentChannels=new Set(prior.filter(x=>x.status==='sent').map(x=>x.channel));
      const pending=cleanChannels(row.reminder_channels).filter(x=>!sentChannels.has(x));
      try{
        const result=pending.length?await sendCommunication({patientId:row.patient_id,providerId:row.provider_id,appointmentId:row.appointment_id,sentByUserId:null,channels:pending,subject:'WannaTalk follow-up reminder',message:renderApplicationMessage(row.reminder_message,row)}):{deliveries:[]};
        const combined=[...prior,...result.deliveries];for(const item of result.deliveries)if(item.status==='sent')sentChannels.add(item.channel);
        const allSent=cleanChannels(row.reminder_channels).every(x=>sentChannels.has(x));
        await client.query(`UPDATE application_follow_up_deliveries SET status=$2,delivery_summary=$3::jsonb,error_message=$4,sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END,updated_at=now() WHERE id=$1`,
          [claim.rows[0].id,allSent?'sent':'failed',JSON.stringify(combined),allSent?null:'One or more delivery channels failed']);
      }catch(error){await client.query(`UPDATE application_follow_up_deliveries SET status='failed',error_message=$2,updated_at=now() WHERE id=$1`,[claim.rows[0].id,String(error.message).slice(0,500)]);}
    }
  }finally{try{if(locked)await client.query('SELECT pg_advisory_unlock(481932,14)');}finally{client.release();}}
}

// Durable claims and a session lock keep multiple API instances from sending the same due reminder.
export async function runScheduledFollowUps({ database = pool } = {}) {
  const client = await database.connect();
  let locked = false;
  try {
    locked = (await client.query('SELECT pg_try_advisory_lock(481932, 13) AS locked')).rows[0].locked;
    if (!locked) return;

    const claimed = await client.query(`
      WITH due AS (
        SELECT id FROM follow_ups
        WHERE reminder_schedule_enabled = true AND status = 'open' AND due_at <= now()
          AND reminder_schedule_attempts < $1
          AND (reminder_schedule_claimed_at IS NULL OR reminder_schedule_claimed_at < now() - interval '1 minute')
        ORDER BY due_at FOR UPDATE SKIP LOCKED LIMIT 25
      )
      UPDATE follow_ups f SET reminder_schedule_claimed_at = now(),
        reminder_schedule_attempts = f.reminder_schedule_attempts + 1,
        reminder_attempted_at = COALESCE(f.reminder_attempted_at, now()), updated_at = now()
      FROM due WHERE f.id = due.id RETURNING f.*`, [MAX_ATTEMPTS]);

    for (const followUp of claimed.rows) {
      const channels = cleanChannels(followUp.reminder_channels);
      try {
        const prior = await query(`SELECT channel FROM communication_deliveries
          WHERE follow_up_id = $1 AND status = 'sent'`, [followUp.id]);
        const sentChannels = new Set(prior.rows.map((row) => row.channel));
        const pendingChannels = channels.filter((channel) => !sentChannels.has(channel));
        if (pendingChannels.length) {
          const delivery = await sendPatientCommunication({
            patientId: followUp.patient_id,
            providerId: followUp.provider_id,
            appointmentId: followUp.appointment_id,
            followUpId: followUp.id,
            sentByUserId: null,
            channels: pendingChannels,
            subject: 'WannaTalk follow-up reminder',
            message: followUp.reminder_message || 'WannaTalk reminder: please contact us to arrange your recommended follow-up session.',
          });
          for (const item of delivery.deliveries) if (item.status === 'sent') sentChannels.add(item.channel);
        }

        const hasSuccess = sentChannels.size > 0;
        const allSent = channels.length > 0 && channels.every((channel) => sentChannels.has(channel));
        const exhausted = followUp.reminder_schedule_attempts >= MAX_ATTEMPTS;
        await query(`UPDATE follow_ups SET
          reminder_sent_at = CASE WHEN $2 THEN COALESCE(reminder_sent_at, now()) ELSE reminder_sent_at END,
          reminder_schedule_enabled = CASE WHEN $3 OR $4 THEN false ELSE true END,
          reminder_schedule_claimed_at = CASE WHEN $3 OR $4 THEN NULL ELSE now() END,
          reminder_schedule_completed_at = CASE WHEN $3 OR $4 THEN now() ELSE reminder_schedule_completed_at END,
          updated_at = now()
          WHERE id = $1 AND reminder_schedule_enabled = true`, [followUp.id, hasSuccess, allSent, exhausted]);
      } catch (error) {
        console.error(`Scheduled follow-up ${followUp.id}:`, error.message);
        const exhausted = followUp.reminder_schedule_attempts >= MAX_ATTEMPTS;
        await query(`UPDATE follow_ups SET
          reminder_schedule_enabled = CASE WHEN $2 THEN false ELSE true END,
          reminder_schedule_claimed_at = CASE WHEN $2 THEN NULL ELSE now() - interval '2 minutes' END,
          reminder_schedule_completed_at = CASE WHEN $2 THEN now() ELSE reminder_schedule_completed_at END,
          updated_at = now() WHERE id = $1 AND reminder_schedule_enabled = true`, [followUp.id, exhausted]);
      }
    }
  } finally {
    try { if (locked) await client.query('SELECT pg_advisory_unlock(481932, 13)'); }
    finally { client.release(); }
  }
}

export function startScheduledFollowUps() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runScheduledFollowUps(); await runApplicationFollowUps(); }
    catch (error) { console.error('Scheduled follow-up worker:', error.message); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 30000);
  void tick();
  return () => clearInterval(timer);
}
