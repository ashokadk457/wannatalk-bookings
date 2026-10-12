import { Router } from 'express';
import { query } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';

export const reminderTemplatesRouter = Router();
reminderTemplatesRouter.use(authRequired(['admin', 'provider']));
reminderTemplatesRouter.get('/', async (req, res, next) => {
  try {
    const result = await query('SELECT id, name, language, channel, subject, message FROM reminder_templates WHERE owner_user_id = $1 ORDER BY name', [req.user.id]);
    res.json({ templates: result.rows });
  } catch (error) { next(error); }
});
async function save(req, res, next) {
  try {
    const { name, language, channel, subject = '', message } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.length > 100 || !['en', 'af'].includes(language) || !['email', 'sms'].includes(channel) || typeof message !== 'string' || !message.trim() || message.length > 1000 || typeof subject !== 'string' || subject.length > 160 || (channel === 'email' && !subject.trim())) {
      return res.status(400).json({ error: 'Valid template name, language, channel and message are required; email also needs a subject.' });
    }
    const values = [name.trim(), language, channel, channel === 'email' ? subject.trim() : '', message.trim(), req.user.id];
    const result = req.params.id
      ? await query('UPDATE reminder_templates SET name=$1, language=$2, channel=$3, subject=$4, message=$5, updated_at=now() WHERE owner_user_id=$6 AND id=$7 RETURNING *', [...values, req.params.id])
      : await query('INSERT INTO reminder_templates (name, language, channel, subject, message, owner_user_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', values);
    if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.status(req.params.id ? 200 : 201).json({ template: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That template name already exists for this language and channel. Choose another name or save changes.' });
    next(error);
  }
}
reminderTemplatesRouter.post('/', save);
reminderTemplatesRouter.put('/:id', save);
