import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { query } from '../db.js';

export const whatsappInboundRouter = Router();

function validSignature(rawBody, header, secret) {
  if (!rawBody || !header || !secret) return false;
  const supplied = String(header).replace(/^sha256=/i, '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(supplied)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const actual = Buffer.from(supplied, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

whatsappInboundRouter.post('/', async (req, res) => {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ success: false, error: 'WhatsApp webhook is not configured' });
  if (!validSignature(req.rawBody, req.get('X-Webhook-Signature'), secret)) {
    return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
  }
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const event = typeof payload.event === 'string' ? payload.event : 'unknown';
    await query(
      `INSERT INTO whatsapp_inbound_webhooks (event, payload, received_at)
       VALUES ($1, $2::jsonb, now())`,
      [event, JSON.stringify(payload)],
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('WhatsApp inbound webhook could not be stored:', error.message);
    return res.status(500).json({ success: false, error: 'Unable to store inbound message' });
  }
});
