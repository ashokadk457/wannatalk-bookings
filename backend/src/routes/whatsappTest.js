import { Router } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { getWhatsAppMessagesByPhone, sendWhatsAppMsg } from '../whatsapp.js';

export const whatsappTestRouter = Router();
whatsappTestRouter.use(authRequired(['admin']));

whatsappTestRouter.post('/send', async (req, res) => {
  const phoneNumber = String(req.body.phoneNumber || '').trim();
  const message = String(req.body.message || '').trim();
  if (!phoneNumber || !message) return res.status(400).json({ error: 'Phone number and message are required' });
  if (message.length > 1000) return res.status(400).json({ error: 'Message must be 1000 characters or fewer' });
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.startsWith('0') ? digits.length < 10 : digits.length < 11) {
    return res.status(400).json({ error: 'Include the country code, for example 27821234567. A local South African number starting with 0 is also accepted.' });
  }
  try {
    const providerResponse = await sendWhatsAppMsg({ phoneNumber, message });
    return res.json({ success: true, providerResponse });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'WhatsApp send failed' });
  }
});

whatsappTestRouter.get('/history', async (req, res) => {
  const phoneNumber = String(req.query.phoneNumber || '').trim();
  if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required' });
  try {
    const history = await getWhatsAppMessagesByPhone(phoneNumber);
    return res.json({ history });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to load WhatsApp history' });
  }
});
