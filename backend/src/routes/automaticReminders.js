import { Router } from 'express';
import { query } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';
import { defaultAutomaticTemplates, validateSettings } from '../automaticReminderContent.js';
export const automaticRemindersRouter = Router();
automaticRemindersRouter.use(authRequired(['provider']));
async function providerId(req) {
  const result = await query('SELECT id FROM providers WHERE user_id=$1', [req.user.id]);
  if (!result.rows[0]) throw Object.assign(new Error('Provider profile not found'), {statusCode:404});
  return result.rows[0].id;
}
automaticRemindersRouter.get('/', async (req,res,next) => {
  try {
    const id = await providerId(req);
    const result = await query('SELECT enabled, offsets, language, templates FROM provider_reminder_settings WHERE provider_id=$1', [id]);
    const deliveries = await query('SELECT id, appointment_id, recipient_kind, recipient, offset_minutes, status, error_message, created_at, sent_at FROM automatic_reminder_deliveries WHERE provider_id=$1 ORDER BY created_at DESC LIMIT 50', [id]);
    res.json({settings:result.rows[0] || {enabled:false, offsets:[], language:'en', templates:defaultAutomaticTemplates}, deliveries:deliveries.rows, timezone:process.env.APPOINTMENT_TIMEZONE || 'Africa/Johannesburg'});
  } catch(error) {next(error);}
});
automaticRemindersRouter.put('/', async (req,res,next) => {
  try {
    validateSettings(req.body);
    const id = await providerId(req);
    const {enabled, offsets, language, templates} = req.body;
    await query(`INSERT INTO provider_reminder_settings (provider_id, enabled, offsets, language, templates)
      VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (provider_id) DO UPDATE
      SET enabled=EXCLUDED.enabled, offsets=EXCLUDED.offsets, language=EXCLUDED.language, templates=EXCLUDED.templates,
      enabled_at=CASE WHEN EXCLUDED.enabled AND NOT provider_reminder_settings.enabled THEN now() ELSE provider_reminder_settings.enabled_at END, updated_at=now()`, [id,enabled,[...new Set(offsets)],language,JSON.stringify(templates)]);
    res.json({ok:true});
  } catch(error) {next(error);}
});
