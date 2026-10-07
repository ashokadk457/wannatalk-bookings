import { Router } from 'express';
import { withTransaction } from '../db.js';
import { generateStoredInvoicePdf, parseInvoiceAmount } from '../invoice.js';
import { sendInvoiceEmail } from '../mail.js';
import { authRequired } from '../middleware/authRequired.js';

export const invoicesRouter = Router();

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function formatInvoiceTime(value) {
  return String(value || '').slice(0, 5);
}

function mapInvoice(header, items) {
  return {
    ...header,
    total_amount: Number(header.total_amount),
    items: items.map((item) => ({ ...item, amount: Number(item.amount) })),
  };
}

async function loadInvoice(client, invoiceId) {
  const header = await client.query(
    `SELECT i.id, i.invoice_number, i.patient_id, i.total_amount, i.status, i.issued_at,
            u.full_name AS patient_name, u.email AS patient_email, u.mobile AS patient_mobile,
            p.title AS patient_title, p.date_of_birth::date::text AS patient_date_of_birth
     FROM invoices i
     JOIN patients p ON p.id = i.patient_id
     JOIN app_users u ON u.id = p.user_id
     WHERE i.id = $1`,
    [invoiceId]
  );
  if (!header.rows[0]) return null;
  const items = await client.query(
    `SELECT ii.id, ii.invoice_id, ii.appointment_id, ii.description, ii.amount,
            a.appointment_date::date::text AS appointment_date,
            a.appointment_time::time::text AS appointment_time,
            a.appointment_type, a.mode, pr.full_name AS provider_name
     FROM invoice_items ii
     JOIN appointments a ON a.id = ii.appointment_id
     JOIN providers provider ON provider.id = a.provider_id
     JOIN app_users pr ON pr.id = provider.user_id
     WHERE ii.invoice_id = $1
     ORDER BY a.appointment_date, a.appointment_time`,
    [invoiceId]
  );
  return mapInvoice(header.rows[0], items.rows);
}

invoicesRouter.post('/', authRequired(['admin']), asyncHandler(async (req, res) => {
  const requested = Array.isArray(req.body.items) ? req.body.items : [];
  const items = requested.map((item) => ({
    appointmentId: String(item.appointmentId || ''),
    amount: parseInvoiceAmount(item.amount),
  }));
  if (!items.length || items.some((item) => !item.appointmentId || item.amount === null)) {
    return res.status(400).json({ error: 'Select at least one appointment and enter a valid amount for every item' });
  }
  if (new Set(items.map((item) => item.appointmentId)).size !== items.length) {
    return res.status(400).json({ error: 'An appointment can only appear once on an invoice' });
  }

  const invoice = await withTransaction(async (client) => {
    const appointmentIds = items.map((item) => item.appointmentId);
    const appointments = await client.query(
      `SELECT a.id, a.patient_id, a.appointment_date::date::text AS appointment_date,
              a.appointment_time::time::text AS appointment_time, a.appointment_type, a.mode,
              pu.full_name AS patient_name, pu.email AS patient_email, pu.mobile AS patient_mobile,
              patient.title AS patient_title, patient.date_of_birth::date::text AS patient_date_of_birth,
              pr.full_name AS provider_name
       FROM appointments a
       JOIN patients patient ON patient.id = a.patient_id
       JOIN app_users pu ON pu.id = patient.user_id
       JOIN providers provider ON provider.id = a.provider_id
       JOIN app_users pr ON pr.id = provider.user_id
       WHERE a.id = ANY($1::uuid[])
       FOR UPDATE OF a`,
      [appointmentIds]
    );
    if (appointments.rows.length !== appointmentIds.length) {
      const error = new Error('One or more appointments no longer exist');
      error.statusCode = 400;
      throw error;
    }
    if (new Set(appointments.rows.map((row) => row.patient_id)).size !== 1) {
      const error = new Error('All invoice appointments must belong to the same patient');
      error.statusCode = 400;
      throw error;
    }

    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const sequence = await client.query(`SELECT nextval('invoice_number_seq') AS value`);
    const invoiceNumber = `WT-${new Date().getFullYear()}-${String(sequence.rows[0].value).padStart(6, '0')}`;
    const savedHeader = await client.query(
      `INSERT INTO invoices (invoice_number, patient_id, created_by_user_id, total_amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id, invoice_number, patient_id, total_amount, status, issued_at`,
      [invoiceNumber, appointments.rows[0].patient_id, req.user.id, total.toFixed(2)]
    );

    for (const item of items) {
      const appointment = appointments.rows.find((row) => row.id === item.appointmentId);
      const description = `${appointment.appointment_type} (${appointment.mode})`;
      await client.query(
        `INSERT INTO invoice_items (invoice_id, appointment_id, description, amount)
         VALUES ($1, $2, $3, $4)`,
        [savedHeader.rows[0].id, appointment.id, description, item.amount.toFixed(2)]
      );
    }
    return loadInvoice(client, savedHeader.rows[0].id);
  });
  res.status(201).json({ invoice });
}));

invoicesRouter.get('/:id', authRequired(['admin']), asyncHandler(async (req, res) => {
  const invoice = await withTransaction((client) => loadInvoice(client, req.params.id));
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ invoice });
}));

invoicesRouter.get('/:id/pdf', authRequired(['admin']), asyncHandler(async (req, res) => {
  const invoice = await withTransaction((client) => loadInvoice(client, req.params.id));
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const pdf = await generateStoredInvoicePdf(invoice);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
  res.send(pdf);
}));

invoicesRouter.post('/:id/email', authRequired(['admin']), asyncHandler(async (req, res) => {
  const invoice = await withTransaction((client) => loadInvoice(client, req.params.id));
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (!invoice.patient_email) return res.status(400).json({ error: 'The patient does not have an email address' });
  const pdf = await generateStoredInvoicePdf(invoice);
  await sendInvoiceEmail({
    email: invoice.patient_email,
    fullName: invoice.patient_name,
    subject: `WannaTalk invoice ${invoice.invoice_number}`,
    message: `Please find attached invoice ${invoice.invoice_number} for your WannaTalk appointment${invoice.items.length === 1 ? '' : 's'}.`,
    pdfBuffer: pdf,
    filename: `${invoice.invoice_number}.pdf`,
  });
  res.json({ success: true, message: `Invoice ${invoice.invoice_number} emailed successfully.` });
}));
