import { Router } from 'express';
import crypto from 'node:crypto';
import { query, withTransaction } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';
import { generateInvoicePdf, parseInvoiceAmount } from '../invoice.js';
import { sendCommunicationEmail, sendInvoiceEmail } from '../mail.js';
import { sendSms } from '../sms.js';

export const appointmentsRouter = Router();

const activeStatuses = ['Booked', 'Confirmed', 'Arrived', 'Completed'];
const validStatuses = new Set(['Booked', 'Confirmed', 'Arrived', 'Completed', 'Cancelled', 'No-show']);

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function isPast(date, time) {
  return new Date(`${date}T${time}`) <= new Date();
}

function meetingBaseUrl() {
  return String(process.env.JITSI_BASE_URL || 'https://webrtc.wannatalk.co.za').replace(/\/+$/, '');
}

function isOnlineMode(value) {
  return String(value || '').trim().toLowerCase() === 'online';
}

function createMeetingUrl() {
  return `${meetingBaseUrl()}/wannatalk-${crypto.randomBytes(9).toString('hex')}`;
}

async function notifyProvider(appointmentId, event) {
  try {
    const result = await query(`SELECT a.appointment_date::date::text AS appointment_date, a.appointment_time::time::text AS appointment_time, a.appointment_type, a.mode, pu.full_name AS patient_name, pr.full_name AS provider_name, pr.email AS provider_email, pr.mobile AS provider_mobile FROM appointments a JOIN patients pat ON pat.id = a.patient_id JOIN app_users pu ON pu.id = pat.user_id JOIN providers pro ON pro.id = a.provider_id JOIN app_users pr ON pr.id = pro.user_id WHERE a.id = $1`, [appointmentId]);
    const a = result.rows[0];
    if (!a) return;
    const subject = `Appointment ${event}: ${a.patient_name}`;
    const message = `Appointment ${event}.\nPatient: ${a.patient_name}\nDate: ${a.appointment_date}\nTime: ${a.appointment_time}\nType: ${a.appointment_type}\nMode: ${a.mode}`;
    await Promise.allSettled([
      a.provider_email ? sendCommunicationEmail({ email: a.provider_email, fullName: a.provider_name, subject, message }) : Promise.resolve(),
      a.provider_mobile ? sendSms({ phoneNumber: a.provider_mobile, message }) : Promise.resolve(),
    ]);
  } catch (error) {
    console.error('Provider appointment notification failed', error);
  }
}

export async function assertProviderAvailable(client, { providerId, locationId = null, appointmentDate, appointmentTime, durationMinutes, excludeAppointmentId = null }) {
  const duration = Number(durationMinutes);
  if (!Number.isInteger(duration) || duration < 15 || duration > 480) {
    const error = new Error('Invalid appointment duration');
    error.statusCode = 400;
    throw error;
  }

  const provider = await client.query(
    `SELECT p.id, p.is_online
     FROM providers p JOIN app_users u ON u.id = p.user_id
     WHERE p.id = $1 AND u.is_active = true
     FOR UPDATE OF p`,
    [providerId]
  );
  if (!provider.rows[0]) {
    const error = new Error('Provider not found or inactive');
    error.statusCode = 404;
    throw error;
  }

  let hasLocationSchedule = false;
  if (locationId) {
    const locationSchedule = await client.query(`SELECT is_available, start_time, end_time,
      (is_available = true AND start_time <= $4::time AND end_time >= ($4::time + ($5 * interval '1 minute'))::time) AS slot_allowed
      FROM provider_location_availability WHERE provider_id = $1 AND location_id = $2 AND day_of_week = EXTRACT(DOW FROM $3::date)::integer`, [providerId, locationId, appointmentDate, appointmentTime, duration]);
    hasLocationSchedule = Boolean(locationSchedule.rows[0]);
    if (locationSchedule.rows[0] && !locationSchedule.rows[0].slot_allowed) { const error = new Error('The provider is not available at this location and time'); error.statusCode = 409; throw error; }
    const unavailableDay = await client.query(`SELECT 1 FROM provider_unavailable_days WHERE provider_id = $1 AND (location_id IS NULL OR location_id = $2) AND unavailable_date = $3`, [providerId, locationId, appointmentDate]);
    if (unavailableDay.rows[0]) { const error = new Error('The provider is unavailable at this location on that day'); error.statusCode = 409; throw error; }
    const unavailableSlot = await client.query(`SELECT 1 FROM provider_unavailable_slots WHERE provider_id = $1 AND (location_id IS NULL OR location_id = $2) AND unavailable_date = $3 AND start_time < ($4::time + ($5 * interval '1 minute'))::time AND end_time > $4::time LIMIT 1`, [providerId, locationId, appointmentDate, appointmentTime, duration]);
    if (unavailableSlot.rows[0]) { const error = new Error('The provider is unavailable during that slot'); error.statusCode = 409; throw error; }
  }

  // Location schedules override the general schedule, matching the patient calendar.
  if (!hasLocationSchedule) {
    const weeklyAvailability = await client.query(
      `SELECT 1 FROM provider_availability
     WHERE provider_id = $1
       AND day_of_week = EXTRACT(DOW FROM $2::date)::integer
       AND is_available = true
       AND start_time <= $3::time
       AND end_time >= ($3::time + ($4 * interval '1 minute'))::time`,
      [providerId, appointmentDate, appointmentTime, duration]
    );
    if (!weeklyAvailability.rows[0]) {
      const error = new Error('No availability for this provider at the selected time');
      error.statusCode = 409;
      throw error;
    }
  }

  const blocked = await client.query(
    `SELECT id FROM provider_time_blocks
     WHERE provider_id = $1 AND block_date = $2
       AND start_time < ($3::time + ($4 * interval '1 minute'))::time
       AND end_time > $3::time
     LIMIT 1`,
    [providerId, appointmentDate, appointmentTime, duration]
  );
  if (blocked.rows[0]) {
    const error = new Error('The provider is unavailable during that time');
    error.statusCode = 409;
    throw error;
  }

  const params = [providerId, appointmentDate, appointmentTime, duration, activeStatuses];
  let exclusion = '';
  if (excludeAppointmentId) {
    params.push(excludeAppointmentId);
    exclusion = `AND id <> $6`;
  }
  const conflict = await client.query(
    `SELECT id FROM appointments
     WHERE provider_id = $1 AND appointment_date = $2
       AND appointment_time < ($3::time + ($4 * interval '1 minute'))::time
       AND (appointment_time + (duration_minutes * interval '1 minute'))::time > $3::time
       AND status = ANY($5::text[])
       ${exclusion}
     LIMIT 1`,
    params
  );
  if (conflict.rows[0]) {
    const error = new Error('That booking time is not available');
    error.statusCode = 409;
    throw error;
  }
}

async function audit(client, user, action, appointmentId, details = {}) {
  await client.query(
    `INSERT INTO audit_logs (user_id, user_name, user_role, action, appointment_id, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [user.id, user.name || user.email || user.role, user.role, action, appointmentId, JSON.stringify(details)]
  );
}

const recurrenceUnits=new Set(['days','weeks','months']);
function recurrenceDates(startDate,interval,unit,count){const result=[],start=new Date(`${startDate}T12:00:00Z`),day=start.getUTCDate();for(let i=0;i<count;i++){let date;if(unit==='months'){const month=start.getUTCMonth()+i*interval,year=start.getUTCFullYear()+Math.floor(month/12),normalized=((month%12)+12)%12,last=new Date(Date.UTC(year,normalized+1,0)).getUTCDate();date=new Date(Date.UTC(year,normalized,Math.min(day,last),12));}else{date=new Date(start);date.setUTCDate(date.getUTCDate()+i*interval*(unit==='weeks'?7:1));}result.push(date.toISOString().slice(0,10));}return result;}
function recurringInput(body){const input={patientId:String(body.patientId||''),providerId:String(body.providerId||''),locationId:String(body.locationId||''),startDate:String(body.startDate||''),appointmentTime:String(body.appointmentTime||''),durationMinutes:Number(body.durationMinutes),recurrenceInterval:Number(body.recurrenceInterval),recurrenceUnit:String(body.recurrenceUnit||''),occurrenceCount:Number(body.occurrenceCount),appointmentType:String(body.appointmentType||'').trim(),mode:String(body.mode||'').trim(),note:String(body.note||'').trim().slice(0,2000),intakeRequested:body.intakeRequested===true};if(!input.patientId||!input.providerId||!input.locationId||!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.appointmentTime)||!Number.isInteger(input.durationMinutes)||input.durationMinutes<15||input.durationMinutes>480||!Number.isInteger(input.recurrenceInterval)||input.recurrenceInterval<1||input.recurrenceInterval>52||!recurrenceUnits.has(input.recurrenceUnit)||!Number.isInteger(input.occurrenceCount)||input.occurrenceCount<2||input.occurrenceCount>104||!input.appointmentType||!input.mode)throw Object.assign(new Error('Complete all recurring booking fields with valid values'),{statusCode:400});if(input.startDate<new Date().toISOString().slice(0,10))throw Object.assign(new Error('Recurring bookings must start today or later'),{statusCode:400});return input;}
async function materializeRecurring(client,series,input){const occurrences=[];for(const [index,date] of recurrenceDates(input.startDate,input.recurrenceInterval,input.recurrenceUnit,input.occurrenceCount).entries()){let appointmentId=null,status='booked',reason=null;try{await assertProviderAvailable(client,{providerId:input.providerId,locationId:input.locationId,appointmentDate:date,appointmentTime:input.appointmentTime,durationMinutes:input.durationMinutes});const meetingUrl=isOnlineMode(input.mode)?createMeetingUrl():null;const saved=await client.query(`INSERT INTO appointments(provider_id,patient_id,location_id,appointment_date,appointment_time,duration_minutes,appointment_type,mode,note,intake_requested,meeting_url,recurring_series_id,recurring_occurrence_number) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,[input.providerId,input.patientId,input.locationId,date,input.appointmentTime,input.durationMinutes,input.appointmentType,input.mode,input.note||null,input.intakeRequested,meetingUrl,series.id,index+1]);appointmentId=saved.rows[0].id;}catch(error){if(error.statusCode!==409)throw error;status='conflict';reason=error.message;}const occurrence=(await client.query(`INSERT INTO recurring_booking_occurrences(series_id,occurrence_number,appointment_date,appointment_id,status,conflict_reason) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[series.id,index+1,date,appointmentId,status,reason])).rows[0];occurrences.push(occurrence);}return occurrences;}

appointmentsRouter.get('/recurring',authRequired(['admin']),asyncHandler(async(req,res)=>{const result=await query(`SELECT s.*,pu.full_name patient_name,pru.full_name provider_name,l.name location_name,COALESCE(json_agg(json_build_object('id',o.id,'occurrenceNumber',o.occurrence_number,'appointmentDate',o.appointment_date::text,'appointmentId',o.appointment_id,'status',o.status,'conflictReason',o.conflict_reason) ORDER BY o.occurrence_number) FILTER(WHERE o.id IS NOT NULL),'[]') occurrences FROM recurring_booking_series s JOIN patients p ON p.id=s.patient_id JOIN app_users pu ON pu.id=p.user_id JOIN providers pr ON pr.id=s.provider_id JOIN app_users pru ON pru.id=pr.user_id JOIN locations l ON l.id=s.location_id LEFT JOIN recurring_booking_occurrences o ON o.series_id=s.id GROUP BY s.id,pu.full_name,pru.full_name,l.name ORDER BY s.created_at DESC`);res.json({series:result.rows});}));

appointmentsRouter.post('/recurring',authRequired(['admin']),asyncHandler(async(req,res)=>{const input=recurringInput(req.body);const result=await withTransaction(async client=>{const series=(await client.query(`INSERT INTO recurring_booking_series(patient_id,provider_id,location_id,created_by_user_id,start_date,appointment_time,duration_minutes,recurrence_interval,recurrence_unit,occurrence_count,appointment_type,mode,note,intake_requested) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,[input.patientId,input.providerId,input.locationId,req.user.id,input.startDate,input.appointmentTime,input.durationMinutes,input.recurrenceInterval,input.recurrenceUnit,input.occurrenceCount,input.appointmentType,input.mode,input.note||null,input.intakeRequested])).rows[0];const occurrences=await materializeRecurring(client,series,input);await audit(client,req.user,'Created recurring booking series',null,{seriesId:series.id,booked:occurrences.filter(x=>x.status==='booked').length,conflicts:occurrences.filter(x=>x.status==='conflict').length});return {series,occurrences};});res.status(201).json(result);}));

appointmentsRouter.patch('/recurring/:id',authRequired(['admin']),asyncHandler(async(req,res)=>{const input=recurringInput(req.body);const result=await withTransaction(async client=>{const current=(await client.query(`SELECT * FROM recurring_booking_series WHERE id=$1 FOR UPDATE`,[req.params.id])).rows[0];if(!current)throw Object.assign(new Error('Recurring booking series not found'),{statusCode:404});await client.query(`UPDATE appointments SET status='Cancelled',updated_at=now() WHERE recurring_series_id=$1 AND appointment_date>=CURRENT_DATE AND status IN('Booked','Confirmed')`,[current.id]);await client.query(`DELETE FROM recurring_booking_occurrences WHERE series_id=$1`,[current.id]);const series=(await client.query(`UPDATE recurring_booking_series SET patient_id=$2,provider_id=$3,location_id=$4,start_date=$5,appointment_time=$6,duration_minutes=$7,recurrence_interval=$8,recurrence_unit=$9,occurrence_count=$10,appointment_type=$11,mode=$12,note=$13,intake_requested=$14,updated_at=now() WHERE id=$1 RETURNING *`,[current.id,input.patientId,input.providerId,input.locationId,input.startDate,input.appointmentTime,input.durationMinutes,input.recurrenceInterval,input.recurrenceUnit,input.occurrenceCount,input.appointmentType,input.mode,input.note||null,input.intakeRequested])).rows[0];const occurrences=await materializeRecurring(client,series,input);await audit(client,req.user,'Edited recurring booking series',null,{seriesId:series.id,booked:occurrences.filter(x=>x.status==='booked').length,conflicts:occurrences.filter(x=>x.status==='conflict').length});return {series,occurrences};});res.json(result);}));

appointmentsRouter.delete('/recurring/:id',authRequired(['admin']),asyncHandler(async(req,res)=>{await withTransaction(async client=>{const current=(await client.query(`SELECT id FROM recurring_booking_series WHERE id=$1 FOR UPDATE`,[req.params.id])).rows[0];if(!current)throw Object.assign(new Error('Recurring booking series not found'),{statusCode:404});await client.query(`UPDATE appointments SET status='Cancelled',updated_at=now() WHERE recurring_series_id=$1 AND appointment_date>=CURRENT_DATE AND status IN('Booked','Confirmed')`,[current.id]);await client.query(`DELETE FROM recurring_booking_series WHERE id=$1`,[current.id]);await audit(client,req.user,'Deleted recurring booking series',null,{seriesId:current.id});});res.status(204).end();}));

appointmentsRouter.get('/', authRequired(), asyncHandler(async (req, res) => {
  await query(`UPDATE invoices SET status='Overdue',updated_at=now() WHERE status='Issued' AND outstanding_balance>0 AND due_at<now()`);
  const params = [];
  const where = [];

  if (req.user.role === 'provider') {
    params.push(req.user.id);
    where.push(`pro.user_id = $${params.length}`);
  } else if (req.user.role === 'patient') {
    params.push(req.user.id);
    where.push(`pat.user_id = $${params.length}`);
  }

  if (req.query.providerId) {
    params.push(req.query.providerId);
    where.push(`a.provider_id = $${params.length}`);
  }
  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`a.patient_id = $${params.length}`);
  }
  if (req.query.from) {
    params.push(req.query.from);
    where.push(`a.appointment_date >= $${params.length}`);
  }
  if (req.query.to) {
    params.push(req.query.to);
    where.push(`a.appointment_date <= $${params.length}`);
  }

  const result = await query(
    `SELECT a.id, a.provider_id, a.patient_id, a.location_id,
            a.appointment_date::date::text AS appointment_date,
            a.appointment_time::time::text AS appointment_time,
            a.duration_minutes, a.appointment_type, a.mode, a.status, a.payment_status,
            a.note, a.intake_requested, a.meeting_url, a.created_at, a.updated_at,
            pu.full_name AS patient_name, pu.email AS patient_email, pu.mobile AS patient_mobile,
            pr.full_name AS provider_name, pr.email AS provider_email, pr.mobile AS provider_mobile,
            pro.professional_title, l.name AS location_name,
            inv.invoice_id, inv.invoice_number, inv.invoice_status, inv.total_amount,
            inv.payments_received, inv.outstanding_balance, inv.due_at,
            inv.billing_review, inv.billing_review_reason,
            inv.invoice_provider_id, inv.invoice_patient_id, inv.invoice_company_id, inv.invoice_billing_customer_type,
            (inv.outstanding_balance > 0 AND (a.appointment_date + a.appointment_time) < now()) AS appointment_passed_unpaid,
            EXISTS (
              SELECT 1 FROM communication_deliveries cd
              WHERE cd.patient_id = a.patient_id AND cd.provider_id = a.provider_id
                AND cd.status = 'sent' AND cd.created_at >= a.created_at
            ) AS message_sent,
            EXISTS (
              SELECT 1 FROM follow_ups fu
              WHERE fu.patient_id = a.patient_id AND fu.provider_id = a.provider_id
                AND (
                  fu.reminder_attempted_at IS NOT NULL
                  OR
                  fu.reminder_sent_at IS NOT NULL
                  OR EXISTS (
                    SELECT 1 FROM communication_deliveries cd
                    WHERE cd.follow_up_id = fu.id AND cd.status = 'sent'
                  )
                )
                AND (
                  fu.appointment_id = a.id
                  OR (
                    fu.appointment_id IS NULL
                    AND (
                      fu.reminder_attempted_at >= a.created_at
                      OR
                      fu.reminder_sent_at >= a.created_at
                      OR EXISTS (
                        SELECT 1 FROM communication_deliveries cd
                        WHERE cd.follow_up_id = fu.id
                          AND cd.status = 'sent'
                          AND cd.created_at >= a.created_at
                      )
                    )
                  )
                )
            ) AS follow_up_attempted
     FROM appointments a
     JOIN patients pat ON pat.id = a.patient_id
     JOIN app_users pu ON pu.id = pat.user_id
     JOIN providers pro ON pro.id = a.provider_id
     JOIN app_users pr ON pr.id = pro.user_id
     LEFT JOIN locations l ON l.id = a.location_id
     LEFT JOIN LATERAL (
       SELECT i.id AS invoice_id, i.invoice_number, i.status AS invoice_status,
              i.total_amount, i.payments_received, i.outstanding_balance, i.due_at,
              i.billing_review, i.billing_review_reason, i.provider_id AS invoice_provider_id,
              i.patient_id AS invoice_patient_id, i.company_id AS invoice_company_id,
              i.billing_customer_type AS invoice_billing_customer_type
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE ii.appointment_id = a.id AND i.status NOT IN ('Void', 'Credited')
       ORDER BY i.created_at DESC
       LIMIT 1
     ) inv ON true
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY a.appointment_date, a.appointment_time`,
    params
  );
  res.json({ appointments: result.rows });
}));

appointmentsRouter.post('/', authRequired(['patient', 'provider', 'admin']), asyncHandler(async (req, res) => {
  const { providerId, patientId, locationId, appointmentDate, appointmentTime, durationMinutes = 60, appointmentType, mode, note, intakeRequested = false } = req.body;

  let effectivePatientId = patientId;
  if (req.user.role === 'patient') {
    const patient = await query(`SELECT id FROM patients WHERE user_id = $1`, [req.user.id]);
    effectivePatientId = patient.rows[0]?.id;
  } else if (req.user.role === 'provider') {
    const provider = await query(`SELECT id FROM providers WHERE user_id = $1`, [req.user.id]);
    if (!provider.rows[0] || provider.rows[0].id !== providerId) return res.status(403).json({ error: 'Providers can only create bookings for themselves' });
    const patientAccess = await query(`SELECT 1 FROM appointments WHERE provider_id = $1 AND patient_id = $2 LIMIT 1`, [providerId, effectivePatientId]);
    if (!patientAccess.rows[0]) return res.status(403).json({ error: 'You may only create bookings for your own patients' });
  }

  if (!providerId || !effectivePatientId || !appointmentDate || !appointmentTime || !appointmentType || !mode) {
    return res.status(400).json({ error: 'Missing required booking details' });
  }
  if (isPast(appointmentDate, appointmentTime)) {
    return res.status(400).json({ error: 'Past dates and times cannot be booked' });
  }

  const appointment = await withTransaction(async (client) => {
    await assertProviderAvailable(client, { providerId, locationId, appointmentDate, appointmentTime, durationMinutes });
    const meetingUrl = isOnlineMode(mode) ? createMeetingUrl() : null;

    const inserted = await client.query(
      `INSERT INTO appointments (provider_id, patient_id, location_id, appointment_date, appointment_time, duration_minutes, appointment_type, mode, note, intake_requested, meeting_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [providerId, effectivePatientId, locationId || null, appointmentDate, appointmentTime, durationMinutes, appointmentType, mode, note || null, Boolean(intakeRequested), meetingUrl]
    );
    await audit(client, req.user, 'Created booking', inserted.rows[0].id, { appointmentDate, appointmentTime, mode, meetingUrl: Boolean(meetingUrl) });
    return inserted.rows[0];
  });

  res.status(201).json({ appointment });
  void notifyProvider(appointment.id, 'booked');
}));

appointmentsRouter.patch('/:id/reschedule', authRequired(['admin', 'provider', 'patient']), asyncHandler(async (req, res) => {
  const { appointmentDate, appointmentTime } = req.body;
  if (!appointmentDate || !appointmentTime) return res.status(400).json({ error: 'New date and time are required' });
  if (isPast(appointmentDate, appointmentTime)) return res.status(400).json({ error: 'Past dates and times cannot be booked' });

  const appointment = await withTransaction(async (client) => {
    const access = req.user.role === 'admin'
      ? ''
      : req.user.role === 'provider'
        ? 'AND EXISTS (SELECT 1 FROM providers p WHERE p.id = appointments.provider_id AND p.user_id = $2)'
        : 'AND EXISTS (SELECT 1 FROM patients p WHERE p.id = appointments.patient_id AND p.user_id = $2)';
    const current = await client.query(
      `SELECT * FROM appointments WHERE id = $1 ${access} FOR UPDATE`,
      req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id]
    );
    if (!current.rows[0]) {
      const error = new Error('Appointment not found');
      error.statusCode = 404;
      throw error;
    }

    await assertProviderAvailable(client, {
      providerId: current.rows[0].provider_id,
      locationId: current.rows[0].location_id,
      appointmentDate,
      appointmentTime,
      durationMinutes: current.rows[0].duration_minutes,
      excludeAppointmentId: req.params.id,
    });

    const updated = await client.query(
      `UPDATE appointments SET appointment_date = $1, appointment_time = $2, status = 'Booked', updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [appointmentDate, appointmentTime, req.params.id]
    );
    await audit(client, req.user, 'Rescheduled booking', req.params.id, { appointmentDate, appointmentTime });
    await client.query(
      `UPDATE invoices i SET due_date=$2, due_at=($2::date + $3::time) AT TIME ZONE 'Africa/Johannesburg', updated_at=now()
       FROM invoice_items ii WHERE ii.invoice_id=i.id AND ii.appointment_id=$1 AND i.status NOT IN ('Void','Credited')`,
      [req.params.id, appointmentDate, appointmentTime]
    );
    return updated.rows[0];
  });

  res.json({ appointment });
  void notifyProvider(appointment.id, 'rescheduled');
}));

appointmentsRouter.patch('/:id/edit', authRequired(['admin']), asyncHandler(async (req, res) => {
  const { patientId, providerId, locationId, appointmentDate, appointmentTime, durationMinutes, appointmentType, mode, note, intakeRequested } = req.body;
  if (!patientId || !providerId || !locationId || !appointmentDate || !appointmentTime || !appointmentType || !mode) {
    return res.status(400).json({ error: 'Complete all required booking details' });
  }
  const duration = Number(durationMinutes);
  if (!Number.isInteger(duration) || duration < 15 || duration > 480) {
    return res.status(400).json({ error: 'Duration must be between 15 and 480 minutes' });
  }

  const appointment = await withTransaction(async (client) => {
    const current = await client.query(`SELECT * FROM appointments WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!current.rows[0]) {
      const error = new Error('Appointment not found');
      error.statusCode = 404;
      throw error;
    }
    const whenChanged = String(appointmentDate) !== String(current.rows[0].appointment_date).slice(0, 10)
      || String(appointmentTime).slice(0, 5) !== String(current.rows[0].appointment_time).slice(0, 5);
    if (whenChanged && isPast(appointmentDate, appointmentTime)) {
      const error = new Error('Past dates and times cannot be booked');
      error.statusCode = 400;
      throw error;
    }
    const slotChanged = String(providerId) !== String(current.rows[0].provider_id)
      || String(locationId) !== String(current.rows[0].location_id)
      || String(appointmentDate) !== String(current.rows[0].appointment_date).slice(0, 10)
      || String(appointmentTime).slice(0, 5) !== String(current.rows[0].appointment_time).slice(0, 5)
      || duration !== Number(current.rows[0].duration_minutes);
    if (slotChanged) await assertProviderAvailable(client, {
      providerId, locationId, appointmentDate, appointmentTime,
      durationMinutes: duration, excludeAppointmentId: req.params.id,
    });
    const updated = await client.query(
      `UPDATE appointments SET patient_id = $1, provider_id = $2, location_id = $3,
       appointment_date = $4, appointment_time = $5, duration_minutes = $6,
       appointment_type = $7, mode = $8, note = $9, intake_requested = $10,
       meeting_url = CASE WHEN lower($8) = 'online' THEN COALESCE(meeting_url, $11) ELSE NULL END,
       updated_at = now() WHERE id = $12 RETURNING *`,
      [patientId, providerId, locationId, appointmentDate, appointmentTime, duration,
        appointmentType, mode, note || null, Boolean(intakeRequested), createMeetingUrl(), req.params.id]
    );
    await audit(client, req.user, 'Edited booking', req.params.id, {
      patientId, providerId, locationId, appointmentDate, appointmentTime, durationMinutes: duration,
      appointmentType, mode, intakeRequested: Boolean(intakeRequested),
    });
    const billingChanged = String(providerId) !== String(current.rows[0].provider_id)
      || String(appointmentType) !== String(current.rows[0].appointment_type);
    if (billingChanged) {
      await client.query(
        `UPDATE invoices i SET billing_review=true, billing_review_reason='Provider or service changed after invoice issue', updated_at=now()
         FROM invoice_items ii WHERE ii.invoice_id=i.id AND ii.appointment_id=$1 AND i.status NOT IN ('Void','Credited')`,
        [req.params.id]
      );
      await audit(client, req.user, 'Flagged invoice for billing review', req.params.id, { reason: 'Provider or service changed after invoice issue' });
    } else if (whenChanged) {
      await client.query(
        `UPDATE invoices i SET due_date=$2, due_at=($2::date + $3::time) AT TIME ZONE 'Africa/Johannesburg', updated_at=now()
         FROM invoice_items ii WHERE ii.invoice_id=i.id AND ii.appointment_id=$1 AND i.status NOT IN ('Void','Credited')`,
        [req.params.id, appointmentDate, appointmentTime]
      );
    }
    return updated.rows[0];
  });
  res.json({ appointment });
}));

appointmentsRouter.patch('/:id/status', authRequired(['admin', 'provider', 'patient']), asyncHandler(async (req, res) => {
  const status = String(req.body.status || '');
  if (!validStatuses.has(status)) return res.status(400).json({ error: 'Invalid status' });
  if (req.user.role === 'patient' && status !== 'Cancelled') return res.status(403).json({ error: 'Patients can only cancel their own appointments' });

  const params = [status, req.params.id];
  let access = '';
  if (req.user.role === 'provider') {
    params.push(req.user.id);
    access = `AND EXISTS (SELECT 1 FROM providers p WHERE p.id = appointments.provider_id AND p.user_id = $${params.length})`;
  } else if (req.user.role === 'patient') {
    params.push(req.user.id);
    access = `AND EXISTS (SELECT 1 FROM patients p WHERE p.id = appointments.patient_id AND p.user_id = $${params.length})`;
  }

  const appointment = await withTransaction(async client => {
    const result = await client.query(
      `UPDATE appointments SET status = $1, updated_at = now() WHERE id = $2 ${access} RETURNING *`,
      params
    );
    if (!result.rows[0]) return null;
    await audit(client, req.user, status === 'Cancelled' ? 'Cancelled booking' : 'Changed booking status', req.params.id, { status });
    if (status === 'Cancelled') {
      await client.query(
        `UPDATE invoices i SET billing_review=true, billing_review_reason='Appointment cancelled - credit, refund, or cancellation fee decision required', updated_at=now()
         FROM invoice_items ii WHERE ii.invoice_id=i.id AND ii.appointment_id=$1 AND i.status NOT IN ('Void','Credited')`,
        [req.params.id]
      );
      await audit(client, req.user, 'Flagged invoice for billing review', req.params.id, { reason: 'Appointment cancelled' });
    }
    return result.rows[0];
  });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  res.json({ appointment });
  if (status === 'Cancelled') void notifyProvider(appointment.id, 'cancelled');
}));

appointmentsRouter.delete('/:id', authRequired(['admin']), asyncHandler(async (req, res) => {
  await withTransaction(async (client) => {
    const appointment = await client.query(`SELECT id FROM appointments WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!appointment.rows[0]) {
      const error = new Error('Appointment not found');
      error.statusCode = 404;
      throw error;
    }
    // Invoice lines remain accounting records after their booking is removed.
    await client.query(
      `UPDATE invoice_items ii
       SET service_date = COALESCE(ii.service_date, a.appointment_date), appointment_id = NULL
       FROM appointments a WHERE ii.appointment_id = a.id AND a.id = $1`,
      [req.params.id]
    );
    await audit(client, req.user, 'Deleted booking', req.params.id, { deletedAppointmentId: req.params.id });
    await client.query(`DELETE FROM appointments WHERE id = $1`, [req.params.id]);
  });
  res.status(204).send();
}));

/* =================================================================
   INVOICES (admin only) — patient/provider data is always loaded
   server side from the appointment, never trusted from the client.
   ================================================================= */
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const patientEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadInvoiceData(appointmentId) {
  if (!uuidPattern.test(String(appointmentId || ''))) return null;
  const result = await query(
    `SELECT a.id, a.appointment_date::date::text AS appointment_date, a.appointment_time::time::text AS appointment_time, a.appointment_type,
            pu.full_name AS patient_name, pu.email AS patient_email,
            pat.title AS patient_title, pat.date_of_birth::date::text AS patient_date_of_birth,
            pr.full_name AS provider_name, pro.professional_title
     FROM appointments a
     JOIN patients pat ON pat.id = a.patient_id
     JOIN app_users pu ON pu.id = pat.user_id
     JOIN providers pro ON pro.id = a.provider_id
     JOIN app_users pr ON pr.id = pro.user_id
     WHERE a.id = $1`,
    [appointmentId]
  );
  return result.rows[0] || null;
}

function invoicePdfValues(appointment, amount) {
  return {
    patientTitle: appointment.patient_title,
    patientName: appointment.patient_name,
    patientDateOfBirth: appointment.patient_date_of_birth,
    providerName: appointment.provider_name,
    amount,
  };
}

/** Keeps the stored appointment time (HH:MM:SS text) as professional HH:MM without any timezone conversion. */
function formatInvoiceTime(value) {
  const match = /^(\d{2}:\d{2})/.exec(String(value || ''));
  return match ? match[1] : String(value || '');
}

appointmentsRouter.get('/:id/invoice', authRequired(['admin']), asyncHandler(async (req, res) => {
  const appointment = await loadInvoiceData(req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  res.json({
    appointmentId: appointment.id,
    appointment: {
      date: appointment.appointment_date,
      time: appointment.appointment_time,
      type: appointment.appointment_type,
    },
    patient: {
      name: appointment.patient_name,
      title: appointment.patient_title || null,
      email: appointment.patient_email,
      dateOfBirth: appointment.patient_date_of_birth || null,
    },
    provider: {
      name: appointment.provider_name,
      professionalTitle: appointment.professional_title || null,
    },
  });
}));

appointmentsRouter.get('/:id/invoice/pdf', authRequired(['admin']), asyncHandler(async (req, res) => {
  const amount = parseInvoiceAmount(req.query.amount);
  if (!amount) return res.status(400).json({ error: 'A valid invoice amount is required' });

  const appointment = await loadInvoiceData(req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

  let pdf;
  try {
    pdf = await generateInvoicePdf(invoicePdfValues(appointment, amount));
  } catch (error) {
    console.error('Invoice PDF generation failed', error);
    return res.status(500).json({ error: 'Unable to generate invoice. Please try again.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${appointment.id}.pdf"`);
  res.send(pdf);
}));

appointmentsRouter.post('/:id/invoice/email', authRequired(['admin']), asyncHandler(async (req, res) => {
  const amount = parseInvoiceAmount(req.body.amount);
  if (!amount) return res.status(400).json({ error: 'A valid invoice amount is required' });

  const appointment = await loadInvoiceData(req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

  const patientEmail = String(appointment.patient_email || '').trim();
  if (!patientEmailPattern.test(patientEmail)) {
    return res.status(400).json({ error: 'The patient email for this appointment is missing or invalid' });
  }

  let pdf;
  try {
    pdf = await generateInvoicePdf(invoicePdfValues(appointment, amount));
  } catch (error) {
    console.error('Invoice PDF generation failed', error);
    return res.status(500).json({ error: 'Unable to generate invoice. Please try again.' });
  }

  try {
    await sendInvoiceEmail({
      email: patientEmail,
      fullName: appointment.patient_name,
      subject: `Invoice for your WannaTalk appointment on ${appointment.appointment_date}`,
      message: `Please find attached your invoice for your appointment on ${appointment.appointment_date} at ${formatInvoiceTime(appointment.appointment_time)}.\n\nWannaTalk — You are not alone.`,
      pdfBuffer: pdf,
      filename: `invoice-${appointment.id}.pdf`,
    });
  } catch (error) {
    console.error('Invoice email failed', error);
    return res.status(500).json({ error: 'Unable to email the invoice. Please try again.' });
  }

  res.json({ success: true, message: 'Invoice emailed successfully.' });
}));
