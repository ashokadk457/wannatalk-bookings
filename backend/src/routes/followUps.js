import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { cleanChannels, sendPatientCommunication } from '../communications.js';
import { authRequired } from '../middleware/authRequired.js';

export const followUpsRouter = Router();

followUpsRouter.get('/application-settings', authRequired(['admin']), async (req, res) => {
  const settings = await query(`SELECT enabled,first_send_after_value,first_send_after_unit,repeat_every_value,repeat_every_unit,send_time::text,max_sends,
    applies_to_appointments_from::text,reminder_channels,reminder_message,enabled_at,updated_at
    FROM application_follow_up_settings WHERE singleton=true`);
  const deliveries = await query(`SELECT d.id,d.send_number,d.scheduled_for,d.status,d.attempts,d.error_message,d.sent_at,
    a.appointment_date::text,a.appointment_time::time::text appointment_time,pu.full_name patient_name,pru.full_name provider_name
    FROM application_follow_up_deliveries d JOIN appointments a ON a.id=d.appointment_id
    JOIN patients p ON p.id=d.patient_id JOIN app_users pu ON pu.id=p.user_id
    JOIN providers pr ON pr.id=d.provider_id JOIN app_users pru ON pru.id=pr.user_id
    ORDER BY d.created_at DESC LIMIT 100`);
  res.json({ settings: settings.rows[0] || {
    enabled:false, first_send_after_value:1, first_send_after_unit:'days', repeat_every_value:1, repeat_every_unit:'weeks', send_time:'09:00', max_sends:1,
    applies_to_appointments_from:new Date().toISOString().slice(0,10), reminder_channels:['email'],
    reminder_message:'WannaTalk reminder: please contact us to arrange your recommended follow-up session.'
  }, deliveries:deliveries.rows });
});

followUpsRouter.put('/application-settings', authRequired(['admin']), async (req, res) => {
  const enabled=req.body.enabled===true, first=Number(req.body.firstSendAfterValue), firstUnit=String(req.body.firstSendAfterUnit||''), repeat=Number(req.body.repeatEveryValue), repeatUnit=String(req.body.repeatEveryUnit||''), sendTime=String(req.body.sendTime||''), max=Number(req.body.maxSends);
  const appliesFrom=String(req.body.appliesToAppointmentsFrom||''), channels=cleanChannels(req.body.reminderChannels), message=String(req.body.reminderMessage||'').trim().slice(0,1000);
  if(!Number.isInteger(first)||first<0||first>365||!['days','weeks','months'].includes(firstUnit)||!Number.isInteger(repeat)||repeat<1||repeat>365||!['days','weeks','months'].includes(repeatUnit)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)||!Number.isInteger(max)||max<1||max>12) return res.status(400).json({error:'Enter valid follow-up timing, units, send time, and repeat limits'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(appliesFrom)||!channels.length||!message) return res.status(400).json({error:'Start date, message, and at least one channel are required'});
  await withTransaction(async client=>{
    await client.query(`INSERT INTO application_follow_up_settings(singleton,enabled,first_send_after_value,first_send_after_unit,repeat_every_value,repeat_every_unit,send_time,max_sends,applies_to_appointments_from,reminder_channels,reminder_message,updated_by_user_id,enabled_at)
      VALUES(true,$1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10,$11,CASE WHEN $1 THEN now() ELSE NULL END)
      ON CONFLICT(singleton) DO UPDATE SET enabled=EXCLUDED.enabled,first_send_after_value=EXCLUDED.first_send_after_value,first_send_after_unit=EXCLUDED.first_send_after_unit,
      repeat_every_value=EXCLUDED.repeat_every_value,repeat_every_unit=EXCLUDED.repeat_every_unit,send_time=EXCLUDED.send_time,max_sends=EXCLUDED.max_sends,applies_to_appointments_from=EXCLUDED.applies_to_appointments_from,
      reminder_channels=EXCLUDED.reminder_channels,reminder_message=EXCLUDED.reminder_message,updated_by_user_id=EXCLUDED.updated_by_user_id,
      enabled_at=CASE WHEN EXCLUDED.enabled AND NOT application_follow_up_settings.enabled THEN now() WHEN EXCLUDED.enabled THEN application_follow_up_settings.enabled_at ELSE NULL END,updated_at=now()`,
      [enabled,first,firstUnit,repeat,repeatUnit,sendTime,max,appliesFrom,channels,message,req.user.id]);
    await client.query(`INSERT INTO audit_logs(user_id,user_name,user_role,action,details) VALUES($1,$2,$3,'Updated application follow-up rule',$4::jsonb)`,
      [req.user.id,req.user.name,req.user.role,JSON.stringify({enabled,firstSendAfterValue:first,firstSendAfterUnit:firstUnit,repeatEveryValue:repeat,repeatEveryUnit:repeatUnit,sendTime,maxSends:max,appliesToAppointmentsFrom:appliesFrom,channels})]);
  });
  res.json({ok:true});
});

async function ownProviderId(userId) {
  const result = await query(`SELECT id FROM providers WHERE user_id = $1`, [userId]);
  return result.rows[0]?.id || null;
}

async function providerOwnsPatient(providerId, patientId) {
  const result = await query(`SELECT 1 FROM appointments WHERE provider_id = $1 AND patient_id = $2 LIMIT 1`, [providerId, patientId]);
  return Boolean(result.rows[0]);
}

followUpsRouter.get('/', authRequired(['admin', 'provider']), async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.role === 'provider') {
    params.push(req.user.id);
    where = `WHERE pro.user_id = $1`;
  }
  const result = await query(
    `SELECT f.*, pu.full_name AS patient_name, pu.email AS patient_email, pu.mobile AS patient_mobile,
            pru.full_name AS provider_name
     FROM follow_ups f
     JOIN patients pat ON pat.id = f.patient_id
     JOIN app_users pu ON pu.id = pat.user_id
     JOIN providers pro ON pro.id = f.provider_id
     JOIN app_users pru ON pru.id = pro.user_id
     ${where}
     ORDER BY CASE WHEN f.status = 'open' THEN 0 ELSE 1 END, f.due_at, f.created_at DESC`,
    params
  );
  res.json({ followUps: result.rows });
});

followUpsRouter.post('/', authRequired(['admin', 'provider']), async (req, res) => {
  const patientId = String(req.body.patientId || '');
  let providerId = String(req.body.providerId || '');
  const appointmentId = String(req.body.appointmentId || '') || null;
  const dueAt = new Date(req.body.dueAt);
  const internalNote = String(req.body.internalNote || '').trim().slice(0, 2000);
  const reminderMessage = String(req.body.reminderMessage || '').trim().slice(0, 1000);
  const reminderChannels = cleanChannels(req.body.reminderChannels);
  const scheduleReminder = req.body.scheduleReminder === true;
  if (req.user.role === 'provider') {
    providerId = await ownProviderId(req.user.id);
    if (!providerId || !(await providerOwnsPatient(providerId, patientId))) return res.status(403).json({ error: 'You may only create follow-ups for your own patients' });
  }
  if (!patientId || !providerId || Number.isNaN(dueAt.getTime())) return res.status(400).json({ error: 'Patient, provider, follow-up date, and time are required' });
  if (appointmentId) {
    const appointment = await query(
      `SELECT 1 FROM appointments WHERE id = $1 AND patient_id = $2 AND provider_id = $3`,
      [appointmentId, patientId, providerId]
    );
    if (!appointment.rows[0]) return res.status(400).json({ error: 'Selected appointment does not match this patient and provider' });
  }
  const result = await query(
    `INSERT INTO follow_ups (patient_id, provider_id, appointment_id, created_by_user_id, due_at, internal_note, reminder_message, reminder_channels, reminder_schedule_enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9)
     RETURNING *`,
    [patientId, providerId, appointmentId, req.user.id, dueAt.toISOString(), internalNote || null, reminderMessage || null, reminderChannels, scheduleReminder]
  );
  await query(
    `INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
     VALUES ($1,$2,$3,'Created follow-up',$4::jsonb)`,
    [req.user.id, req.user.name, req.user.role, JSON.stringify({ followUpId: result.rows[0].id, patientId, providerId, dueAt: dueAt.toISOString() })]
  );
  res.status(201).json({ followUp: result.rows[0] });
});

followUpsRouter.patch('/:id/status', authRequired(['admin', 'provider']), async (req, res) => {
  const status = String(req.body.status || '');
  if (!['open', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid follow-up status' });
  const params = [status, req.params.id];
  let access = '';
  if (req.user.role === 'provider') {
    params.push(req.user.id);
    access = `AND EXISTS (SELECT 1 FROM providers p WHERE p.id = follow_ups.provider_id AND p.user_id = $3)`;
  }
  const result = await query(
    `UPDATE follow_ups SET status = $1, completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE NULL END,
       reminder_schedule_enabled = CASE WHEN $1 = 'open' THEN reminder_schedule_enabled ELSE false END,
       reminder_schedule_claimed_at = CASE WHEN $1 = 'open' THEN reminder_schedule_claimed_at ELSE NULL END,
       updated_at = now()
     WHERE id = $2 ${access} RETURNING *`,
    params
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Follow-up not found' });
  res.json({ followUp: result.rows[0] });
});

followUpsRouter.delete('/:id', authRequired(['admin']), async (req, res, next) => {
  try {
    const deleted = await withTransaction(async (client) => {
      const result = await client.query(
        `DELETE FROM follow_ups WHERE id = $1 RETURNING id, patient_id, provider_id`,
        [req.params.id]
      );
      const followUp = result.rows[0];
      if (!followUp) return false;
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
         VALUES ($1,$2,$3,'Deleted follow-up',$4::jsonb)`,
        [req.user.id, req.user.name, req.user.role, JSON.stringify({ followUpId: followUp.id, patientId: followUp.patient_id, providerId: followUp.provider_id })]
      );
      return true;
    });
    if (!deleted) return res.status(404).json({ error: 'Follow-up not found' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

followUpsRouter.post('/:id/send', authRequired(['admin', 'provider']), async (req, res) => {
  const params = [req.params.id];
  let access = '';
  if (req.user.role === 'provider') {
    params.push(req.user.id);
    access = `AND pro.user_id = $2`;
  }
  const followUpResult = await query(
    `SELECT f.*, pu.full_name AS patient_name
     FROM follow_ups f
     JOIN providers pro ON pro.id = f.provider_id
     JOIN patients pat ON pat.id = f.patient_id
     JOIN app_users pu ON pu.id = pat.user_id
     WHERE f.id = $1 ${access}`,
    params
  );
  const followUp = followUpResult.rows[0];
  if (!followUp) return res.status(404).json({ error: 'Follow-up not found' });
  const requestedAppointmentId = String(req.body.appointmentId || '') || followUp.appointment_id || null;
  if (requestedAppointmentId) {
    const appointmentResult = await query(
      `SELECT 1 FROM appointments WHERE id = $1 AND patient_id = $2 AND provider_id = $3`,
      [requestedAppointmentId, followUp.patient_id, followUp.provider_id]
    );
    if (!appointmentResult.rows[0]) return res.status(400).json({ error: 'Selected appointment does not match this follow-up' });
    if (followUp.appointment_id && followUp.appointment_id !== requestedAppointmentId) {
      return res.status(400).json({ error: 'This follow-up is already linked to another appointment' });
    }
    if (!followUp.appointment_id) {
      await query(`UPDATE follow_ups SET appointment_id = $2, updated_at = now() WHERE id = $1`, [followUp.id, requestedAppointmentId]);
    }
  }
  await query(`UPDATE follow_ups SET reminder_schedule_enabled = false, reminder_schedule_claimed_at = NULL,
    reminder_attempted_at = now(), updated_at = now() WHERE id = $1`, [followUp.id]);
  const channels = cleanChannels(req.body.channels?.length ? req.body.channels : followUp.reminder_channels);
  const message = String(req.body.message || followUp.reminder_message || 'WannaTalk reminder: please contact us to arrange your recommended follow-up session.').trim().slice(0, 1000);
  const delivery = await sendPatientCommunication({ patientId: followUp.patient_id, providerId: followUp.provider_id, followUpId: followUp.id, sentByUserId: req.user.id, channels, subject: 'WannaTalk follow-up reminder', message });
  if (delivery.deliveries.some((item) => item.status === 'sent')) await query(`UPDATE follow_ups SET reminder_sent_at = now(), updated_at = now() WHERE id = $1`, [followUp.id]);
  await query(
    `INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
     VALUES ($1,$2,$3,'Sent follow-up reminder',$4::jsonb)`,
    [req.user.id, req.user.name, req.user.role, JSON.stringify({ followUpId: followUp.id, channels, deliveryStatuses: delivery.deliveries.map((item) => item.status) })]
  );
  res.json({ deliveries: delivery.deliveries });
});
