import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';

export const patientsRouter = Router();

patientsRouter.post('/import', authRequired(['admin']), async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length || rows.length > 1000) return res.status(400).json({ error: 'Provide between 1 and 1000 patient rows' });
  const result = await withTransaction(async (client) => {
    const created = [], errors = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {}, email = String(row.email || '').trim().toLowerCase(), password = String(row.pwd || '');
      const firstName = String(row.firstName || '').trim(), lastName = String(row.lastName || '').trim();
      if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12) { errors.push({ row: index + 2, error: 'First Name, Last Name, valid Email, and Pwd of at least 12 characters are required' }); continue; }
      const duplicate = await client.query(`SELECT id FROM app_users WHERE lower(email) = lower($1)`, [email]);
      if (duplicate.rows[0]) { errors.push({ row: index + 2, error: 'Email already exists' }); continue; }
      const user = await client.query(`INSERT INTO app_users (full_name,email,password_hash,role,is_active,registration_status,preferred_contact) VALUES ($1,$2,$3,'patient',true,'approved',$4) RETURNING id`, [`${firstName} ${lastName}`, email, await bcrypt.hash(password, 12), String(row.preferredContact || 'Email')]);
      const encryptionKey = process.env.PII_ENCRYPTION_KEY || process.env.JWT_SECRET;
      await client.query(`INSERT INTO patients (user_id,title,first_name,last_name,identity_document_encrypted,date_of_birth,nationality) VALUES ($1,$2,$3,$4,CASE WHEN NULLIF($5,'') IS NULL THEN NULL ELSE pgp_sym_encrypt($5,$6,'cipher-algo=aes256') END,$7,$8)`, [user.rows[0].id, row.title || null, firstName, lastName, String(row.identityDocument || '').trim(), encryptionKey, row.dateOfBirth || null, row.nationality || 'ZA']);
      created.push(email);
    }
    return { created, errors };
  });
  res.json(result);
});

patientsRouter.get('/me', authRequired(['patient']), async (req, res) => {
  const result = await query(
    `SELECT pat.id, u.full_name, u.email, u.mobile, u.preferred_contact, u.is_active,
            pat.title, pat.first_name, pat.last_name, pat.date_of_birth, pat.nationality,
            pgp_sym_decrypt(pat.identity_document_encrypted, $2) AS identity_document
     FROM patients pat JOIN app_users u ON u.id = pat.user_id
     WHERE u.id = $1`,
    [req.user.id, process.env.PII_ENCRYPTION_KEY || process.env.JWT_SECRET]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Patient profile not found' });
  res.json({ patient: result.rows[0] });
});

patientsRouter.get('/', authRequired(), async (req, res) => {
  const params = [];
  let where = '';

  if (req.user.role === 'patient') {
    params.push(req.user.id);
    where = 'WHERE u.id = $1';
  } else if (req.user.role === 'provider') {
    params.push(req.user.id);
    where = `WHERE EXISTS (
      SELECT 1 FROM appointments a
      JOIN providers pro ON pro.id = a.provider_id
      WHERE a.patient_id = pat.id AND pro.user_id = $1
    )`;
  }

  const result = await query(
    `SELECT pat.id, u.full_name, u.email, u.mobile, u.preferred_contact, u.is_active,
            pat.title, pat.first_name, pat.last_name, pat.date_of_birth, pat.nationality,
            pgp_sym_decrypt(pat.identity_document_encrypted, $${params.length + 1}) AS identity_document
     FROM patients pat
     JOIN app_users u ON u.id = pat.user_id
     ${where}
     ORDER BY u.full_name`,
    [...params, process.env.PII_ENCRYPTION_KEY || process.env.JWT_SECRET]
  );
  res.json({ patients: result.rows.map((row) => req.user.role === 'admin' || req.user.role === 'patient' ? row : (({ title, first_name, last_name, date_of_birth, nationality, identity_document, ...safe }) => safe)(row)) });
});

patientsRouter.patch('/me', authRequired(['patient']), async (req, res) => {
  const fullName = String(req.body.fullName || '').trim().slice(0, 100);
  const mobile = String(req.body.mobile || '').trim().slice(0, 30);
  const preferredContact = String(req.body.preferredContact || 'Email').trim();
  const title = String(req.body.title || '').trim().slice(0, 20);
  const firstName = String(req.body.firstName || '').trim().slice(0, 50);
  const lastName = String(req.body.lastName || '').trim().slice(0, 50);
  const dateOfBirth = String(req.body.dateOfBirth || '').trim() || null;
  const nationality = String(req.body.nationality || '').trim().slice(0, 80);
  if (!fullName) return res.status(400).json({ error: 'Full name is required' });
  if (!['Email', 'SMS', 'Both'].includes(preferredContact)) return res.status(400).json({ error: 'Invalid preferred contact method' });
  const patient = await withTransaction(async (client) => {
    const currentResult = await client.query(
      `SELECT pat.id, u.id AS user_id, u.mobile
       FROM patients pat JOIN app_users u ON u.id = pat.user_id
       WHERE u.id = $1 FOR UPDATE`,
      [req.user.id]
    );
    const current = currentResult.rows[0];
    if (!current) return null;
    const mobileChanged = String(current.mobile || '') !== mobile;
    const updated = await client.query(
      `UPDATE app_users
       SET full_name = $1, mobile = $2, preferred_contact = $3,
           mobile_verified_at = CASE WHEN COALESCE(mobile, '') <> $2 THEN NULL ELSE mobile_verified_at END,
           updated_at = now()
       WHERE id = $4
       RETURNING full_name, email, mobile, preferred_contact`,
      [fullName, mobile, preferredContact, current.user_id]
    );
    const encryptionKey = process.env.PII_ENCRYPTION_KEY || process.env.JWT_SECRET;
    await client.query(
      `UPDATE patients SET title = $1, first_name = $2, last_name = $3, date_of_birth = $4,
       nationality = $5,
       identity_document_encrypted = CASE WHEN NULLIF($6, '') IS NULL THEN identity_document_encrypted ELSE pgp_sym_encrypt($6, $7, 'cipher-algo=aes256') END,
       updated_at = now() WHERE id = $8`,
      [title, firstName, lastName, dateOfBirth, nationality, String(req.body.identityDocument || '').trim(), encryptionKey, current.id]
    );
    if (mobileChanged) await client.query(`UPDATE trusted_devices SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [current.user_id]);
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
       VALUES ($1,$2,$3,'Updated own patient profile',$4::jsonb)`,
      [req.user.id, fullName, req.user.role, JSON.stringify({ patientId: current.id, mobileChanged })]
    );
    return { id: current.id, ...updated.rows[0] };
  });
  if (!patient) return res.status(404).json({ error: 'Patient profile not found' });
  res.json({ patient });
});

patientsRouter.patch('/:id', authRequired(['admin']), async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const mobile = String(req.body.mobile || '').trim();
  const preferredContact = String(req.body.preferredContact || 'Email').trim();
  if (!fullName || !email || !email.includes('@')) return res.status(400).json({ error: 'A valid name and email are required' });
  if (!['Email', 'SMS', 'Both'].includes(preferredContact)) return res.status(400).json({ error: 'Invalid preferred contact method' });

  const patient = await withTransaction(async (client) => {
    const currentResult = await client.query(
      `SELECT pat.id, pat.user_id, u.full_name, u.email, u.mobile, u.preferred_contact
       FROM patients pat
       JOIN app_users u ON u.id = pat.user_id
       WHERE pat.id = $1
       FOR UPDATE`,
      [req.params.id]
    );
    const current = currentResult.rows[0];
    if (!current) return null;

    const duplicate = await client.query(
      `SELECT id FROM app_users WHERE lower(email) = lower($1) AND id <> $2`,
      [email, current.user_id]
    );
    if (duplicate.rows[0]) {
      const error = new Error('That email address is already registered');
      error.statusCode = 409;
      throw error;
    }

    const contactChanged = current.email.toLowerCase() !== email || String(current.mobile || '') !== mobile;
    const updatedResult = await client.query(
      `UPDATE app_users
       SET full_name = $1, email = $2, mobile = $3, preferred_contact = $4,
           email_verified_at = CASE WHEN lower(email) <> lower($2) THEN NULL ELSE email_verified_at END,
           mobile_verified_at = CASE WHEN COALESCE(mobile, '') <> $3 THEN NULL ELSE mobile_verified_at END,
           auth_version = auth_version + CASE WHEN $6 THEN 1 ELSE 0 END,
           updated_at = now()
       WHERE id = $5
       RETURNING full_name, email, mobile, preferred_contact, is_active`,
      [fullName, email, mobile || '', preferredContact, current.user_id, contactChanged]
    );
    if (contactChanged) {
      await client.query(`UPDATE trusted_devices SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [current.user_id]);
      await client.query(`UPDATE auth_otp_challenges SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL`, [current.user_id]);
    }
    await client.query(
      `UPDATE patients SET updated_at = now() WHERE id = $1`,
      [current.id]
    );
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
       VALUES ($1, $2, $3, 'Updated patient', $4::jsonb)`,
      [req.user.id, req.user.name || req.user.email || 'Administrator', req.user.role,
        JSON.stringify({ patientId: current.id, email, previousEmail: current.email })]
    );

    return { id: current.id, ...updatedResult.rows[0] };
  });

  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json({ patient });
});

patientsRouter.patch('/:id/deactivate', authRequired(['admin']), async (req, res) => {
  const patient = await setPatientActive(req, false);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json({ patient });
});

patientsRouter.patch('/:id/reactivate', authRequired(['admin']), async (req, res) => {
  const patient = await setPatientActive(req, true);
  if (!patient) return res.status(404).json({ error: 'Approved patient not found' });
  res.json({ patient });
});

async function setPatientActive(req, active) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT pat.id, pat.user_id, u.full_name, u.email
       FROM patients pat
       JOIN app_users u ON u.id = pat.user_id
       WHERE pat.id = $1 AND u.registration_status = 'approved'
       FOR UPDATE`,
      [req.params.id]
    );
    const account = result.rows[0];
    if (!account) return null;

    await client.query(
      `UPDATE app_users
       SET is_active = $1, auth_version = auth_version + 1, updated_at = now()
       WHERE id = $2`,
      [active, account.user_id]
    );
    if (!active) {
      await client.query(`UPDATE trusted_devices SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [account.user_id]);
      await client.query(`UPDATE auth_otp_challenges SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL`, [account.user_id]);
    }
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [req.user.id, req.user.name || req.user.email || 'Administrator', req.user.role,
        active ? 'Reactivated patient' : 'Deactivated patient',
        JSON.stringify({ patientId: account.id, patientUserId: account.user_id, email: account.email })]
    );

    return { id: account.id, fullName: account.full_name, email: account.email, isActive: active };
  });
}
