import { pool, query } from './db.js';
import { cleanChannels, sendPatientCommunication } from './communications.js';

const MAX_ATTEMPTS = 3;

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
    try { await runScheduledFollowUps(); }
    catch (error) { console.error('Scheduled follow-up worker:', error.message); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 30000);
  void tick();
  return () => clearInterval(timer);
}
