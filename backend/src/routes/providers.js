import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';
import { cleanPolicyHtml } from '../policyContent.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const providersRouter = Router();

function canManageProviderBilling(user, providerUserId) {
  return user.role === 'admin' || (user.role === 'provider' && user.id === providerUserId);
}

providersRouter.post('/:id/billing-logo', authRequired(['admin', 'provider']), async (req, res, next) => {
  try {
    const owner = await query(`SELECT user_id FROM providers WHERE id=$1`, [req.params.id]);
    if (!owner.rows[0]) return res.status(404).json({ error: 'Provider not found' });
    if (!canManageProviderBilling(req.user, owner.rows[0].user_id)) return res.status(403).json({ error: 'Not allowed' });
    const match = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.dataUrl || ''));
    if (!match) return res.status(400).json({ error: 'Upload a PNG, JPG or WebP logo' });
    const bytes = Buffer.from(match[3], 'base64');
    if (!bytes.length || bytes.length > 512 * 1024) return res.status(400).json({ error: 'Logo must be smaller than 512 KB' });
    const signatures = { png: bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), jpeg: bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff, webp: bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP' };
    const extension = match[2] === 'jpeg' ? 'jpg' : match[2];
    if (!signatures[match[2]]) return res.status(400).json({ error: 'The uploaded file is not a valid image' });
    const directory = fileURLToPath(new URL('../../uploads/billing-logos/', import.meta.url));
    await mkdir(directory, { recursive: true });
    const filename = `${req.params.id}-${randomUUID()}.${extension}`;
    await writeFile(fileURLToPath(new URL(filename, new URL('../../uploads/billing-logos/', import.meta.url))), bytes, { flag: 'wx' });
    const logoUrl = `/api/uploads/billing-logos/${filename}`;
    await query(`UPDATE provider_billing_profiles SET logo_url=$1,updated_at=now() WHERE provider_id=$2`, [logoUrl, req.params.id]);
    res.status(201).json({ logoUrl });
  } catch (error) { next(error); }
});

providersRouter.get('/:id/billing-profile', authRequired(['admin', 'provider']), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.id AS provider_id, p.user_id, p.practice_number, p.medical_registration_number,
              p.private_practice_name, p.full_address, u.full_name AS provider_name,
              u.email AS provider_email, u.mobile AS provider_mobile,
              bp.registered_business_name, bp.trading_name, bp.company_registration_number,
              COALESCE(bp.vat_registered, false) AS vat_registered, bp.vat_number,
              bp.business_address, bp.billing_address, bp.billing_phone, bp.billing_email,
              bp.bank_account_holder, bp.bank_name, bp.bank_account_number,
              bp.bank_account_type, bp.bank_branch_code, bp.remittance_instructions,
              bp.logo_url, COALESCE(bp.brand_primary_color, '#087b5b') AS brand_primary_color,
              COALESCE(bp.invoice_prefix, 'INV') AS invoice_prefix,
              COALESCE(bp.invoice_next_number, 1) AS invoice_next_number,
              COALESCE(bp.invoice_number_padding, 6) AS invoice_number_padding,
              COALESCE(bp.payment_terms_days, 30) AS payment_terms_days,
              COALESCE(bp.currency_code, 'ZAR') AS currency_code,
              bp.updated_at
       FROM providers p
       JOIN app_users u ON u.id = p.user_id
       LEFT JOIN provider_billing_profiles bp ON bp.provider_id = p.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    const profile = result.rows[0];
    if (!profile) return res.status(404).json({ error: 'Provider not found' });
    if (!canManageProviderBilling(req.user, profile.user_id)) return res.status(403).json({ error: 'Not allowed' });
    delete profile.user_id;
    res.json({ profile });
  } catch (error) { next(error); }
});

providersRouter.put('/:id/billing-profile', authRequired(['admin', 'provider']), async (req, res, next) => {
  try {
    const owner = await query(`SELECT user_id FROM providers WHERE id = $1`, [req.params.id]);
    if (!owner.rows[0]) return res.status(404).json({ error: 'Provider not found' });
    if (!canManageProviderBilling(req.user, owner.rows[0].user_id)) return res.status(403).json({ error: 'Not allowed' });

    const text = (value, max) => String(value || '').trim().slice(0, max) || null;
    const registeredName = text(req.body.registeredBusinessName, 200);
    if (!registeredName) return res.status(400).json({ error: 'Registered business or practice name is required' });
    const email = text(req.body.billingEmail, 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid billing email address' });
    const prefix = String(req.body.invoicePrefix || 'INV').trim().toUpperCase();
    if (!/^[A-Z0-9-]{1,20}$/.test(prefix)) return res.status(400).json({ error: 'Invoice prefix may contain letters, numbers and hyphens only' });
    const nextNumber = Number(req.body.invoiceNextNumber || 1), padding = Number(req.body.invoiceNumberPadding || 6), terms = Number(req.body.paymentTermsDays ?? 30);
    if (!Number.isSafeInteger(nextNumber) || nextNumber < 1) return res.status(400).json({ error: 'Next invoice number must be a positive whole number' });
    if (!Number.isInteger(padding) || padding < 3 || padding > 12) return res.status(400).json({ error: 'Invoice number padding must be between 3 and 12' });
    if (!Number.isInteger(terms) || terms < 0 || terms > 365) return res.status(400).json({ error: 'Payment terms must be between 0 and 365 days' });
    const currency = String(req.body.currencyCode || 'ZAR').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ error: 'Currency must be a three-letter code' });
    const color = String(req.body.brandPrimaryColor || '#087b5b').trim();
    if (!/^#[0-9a-f]{6}$/i.test(color)) return res.status(400).json({ error: 'Brand colour must be a valid hex colour' });
    const vatRegistered = Boolean(req.body.vatRegistered), vatNumber = text(req.body.vatNumber, 80);
    if (vatRegistered && !vatNumber) return res.status(400).json({ error: 'VAT number is required for a VAT-registered provider' });
    const logoUrl = text(req.body.logoUrl, 1000);
    if (logoUrl && !/^(https:\/\/|\/)/i.test(logoUrl)) return res.status(400).json({ error: 'Logo URL must use HTTPS or be an application asset path' });

    const values = [
      req.params.id, registeredName, text(req.body.tradingName, 200),
      text(req.body.companyRegistrationNumber, 80), vatRegistered, vatNumber,
      text(req.body.businessAddress, 1000), text(req.body.billingAddress, 1000), text(req.body.billingPhone, 40), email,
      text(req.body.bankAccountHolder, 200), text(req.body.bankName, 150), text(req.body.bankAccountNumber, 80),
      text(req.body.bankAccountType, 80), text(req.body.bankBranchCode, 40), text(req.body.remittanceInstructions, 2000),
      logoUrl, color, prefix, nextNumber, padding, terms, currency,
    ];
    const saved = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO provider_billing_profiles
          (provider_id, registered_business_name, trading_name, company_registration_number,
           vat_registered, vat_number, business_address, billing_address, billing_phone, billing_email,
           bank_account_holder, bank_name, bank_account_number, bank_account_type, bank_branch_code,
           remittance_instructions, logo_url, brand_primary_color, invoice_prefix, invoice_next_number,
           invoice_number_padding, payment_terms_days, currency_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         ON CONFLICT (provider_id) DO UPDATE SET
           registered_business_name=EXCLUDED.registered_business_name, trading_name=EXCLUDED.trading_name,
           company_registration_number=EXCLUDED.company_registration_number, vat_registered=EXCLUDED.vat_registered,
           vat_number=EXCLUDED.vat_number, business_address=EXCLUDED.business_address,
           billing_address=EXCLUDED.billing_address, billing_phone=EXCLUDED.billing_phone,
           billing_email=EXCLUDED.billing_email, bank_account_holder=EXCLUDED.bank_account_holder,
           bank_name=EXCLUDED.bank_name, bank_account_number=EXCLUDED.bank_account_number,
           bank_account_type=EXCLUDED.bank_account_type, bank_branch_code=EXCLUDED.bank_branch_code,
           remittance_instructions=EXCLUDED.remittance_instructions, logo_url=EXCLUDED.logo_url,
           brand_primary_color=EXCLUDED.brand_primary_color, invoice_prefix=EXCLUDED.invoice_prefix,
           invoice_next_number=EXCLUDED.invoice_next_number, invoice_number_padding=EXCLUDED.invoice_number_padding,
           payment_terms_days=EXCLUDED.payment_terms_days, currency_code=EXCLUDED.currency_code, updated_at=now()
         RETURNING *`, values
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
         VALUES ($1,$2,$3,'Updated provider billing profile',$4::jsonb)`,
        [req.user.id, req.user.name || req.user.email || req.user.role, req.user.role, JSON.stringify({ providerId: req.params.id })]
      );
      return result.rows[0];
    });
    res.json({ profile: saved });
  } catch (error) { next(error); }
});

providersRouter.get('/:id/cancellation-policy', authRequired(), async (req, res, next) => {
  try {
    const result = await query(`SELECT p.id, p.cancellation_policy, p.cancellation_policy_format, u.full_name FROM providers p JOIN app_users u ON u.id=p.user_id
      WHERE p.id=$1 AND ((u.is_active=true AND u.registration_status='approved') OR u.id=$2)`, [req.params.id,req.user.id]);
    if (!result.rows[0]) return res.status(404).json({error:'Provider not found'});
    const provider = result.rows[0];
    if (provider.cancellation_policy_format === 'html') provider.cancellation_policy = cleanPolicyHtml(provider.cancellation_policy || '');
    res.json({provider});
  } catch(error) {next(error);}
});
providersRouter.patch('/:id/cancellation-policy', authRequired(['provider']), async (req,res,next) => {
  try {
    if (typeof req.body.policy !== 'string' || req.body.policy.length > 10000) return res.status(400).json({error:'Cancellation policy must be text of at most 10,000 characters'});
    if (req.body.format !== undefined && !['html','text'].includes(req.body.format)) return res.status(400).json({error:'Invalid policy format'});
    const format = req.body.format || 'text';
    const policy = format === 'html' ? cleanPolicyHtml(req.body.policy) : req.body.policy.trim();
    const result = await query('UPDATE providers SET cancellation_policy=$1,cancellation_policy_format=$4,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id', [policy || null,req.params.id,req.user.id,format]);
    if (!result.rows[0]) return res.status(404).json({error:'Provider not found'});
    res.json({ok:true});
  } catch(error) {next(error);}
});

providersRouter.get('/', authRequired(), async (req, res) => {
  const result = await query(
    `SELECT p.id, u.full_name, u.email, u.mobile, u.is_active, p.title, p.professional_title, p.specialty,
            p.sub_specialties, p.medical_registration_number, p.practice_number, p.practice_setting,
            p.private_practice_name, p.full_address, p.default_duration_minutes, p.bio, p.is_online,
            COALESCE(json_agg(l.name ORDER BY l.name) FILTER (WHERE l.id IS NOT NULL), '[]') AS locations
     FROM providers p
     JOIN app_users u ON u.id = p.user_id
     LEFT JOIN provider_locations pl ON pl.provider_id = p.id
     LEFT JOIN locations l ON l.id = pl.location_id
     WHERE u.registration_status = 'approved'
     GROUP BY p.id, u.full_name, u.email, u.mobile, u.is_active
     ORDER BY u.full_name`
  );
  res.json({ providers: result.rows });
});

providersRouter.get('/:id/availability', authRequired(), async (req, res) => {
  const [availabilityResult, blocksResult, busyResult, locationAvailabilityResult, unavailableDaysResult, unavailableSlotsResult] = await Promise.all([
    query(
      `SELECT day_of_week, is_available, start_time, end_time
       FROM provider_availability
       WHERE provider_id = $1
       ORDER BY day_of_week`,
      [req.params.id]
    ),
    query(
      `SELECT id, block_date, start_time, end_time, reason
       FROM provider_time_blocks
       WHERE provider_id = $1 AND block_date >= current_date
       ORDER BY block_date, start_time`,
      [req.params.id]
    ),
    query(
      `SELECT id, appointment_date::text AS appointment_date,
              appointment_time::text AS appointment_time,
              (appointment_time + (duration_minutes * interval '1 minute'))::time::text AS end_time
       FROM appointments
       WHERE provider_id = $1 AND appointment_date >= current_date
         AND status = ANY($2::text[])
       ORDER BY appointment_date, appointment_time`,
      [req.params.id, ['Booked', 'Confirmed', 'Arrived', 'Completed']]
    ),
    query(`SELECT pla.provider_id, pla.location_id, l.name AS location_name, pla.day_of_week, pla.is_available, pla.start_time, pla.end_time FROM provider_location_availability pla JOIN locations l ON l.id = pla.location_id WHERE pla.provider_id = $1 ORDER BY pla.location_id, pla.day_of_week`, [req.params.id]),
    query(`SELECT id, provider_id, location_id, unavailable_date, reason FROM provider_unavailable_days WHERE provider_id = $1 AND unavailable_date >= current_date ORDER BY unavailable_date`, [req.params.id]),
    query(`SELECT id, provider_id, location_id, unavailable_date, start_time, end_time, reason FROM provider_unavailable_slots WHERE provider_id = $1 AND unavailable_date >= current_date ORDER BY unavailable_date, start_time`, [req.params.id]),
  ]);
  res.json({ availability: availabilityResult.rows, blocks: blocksResult.rows, busy: busyResult.rows, locationAvailability: locationAvailabilityResult.rows, unavailableDays: unavailableDaysResult.rows, unavailableSlots: unavailableSlotsResult.rows });
});

providersRouter.put('/:id/location-availability', authRequired(['provider', 'admin']), async (req, res) => {
  if (req.user.role === 'provider' && !(await query(`SELECT id FROM providers WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id])).rows[0]) return res.status(403).json({ error: 'Not allowed' });
  const locationId = String(req.body.locationId || '');
  const availability = Array.isArray(req.body.availability) ? req.body.availability : [];
  if (!locationId || availability.length !== 7) return res.status(400).json({ error: 'Location and all seven days are required' });
  await withTransaction(async (client) => {
    for (const item of availability) {
      if (!Number.isInteger(Number(item.dayOfWeek)) || Number(item.dayOfWeek) < 0 || Number(item.dayOfWeek) > 6 || !item.startTime || !item.endTime) throw Object.assign(new Error('Invalid availability entry'), { statusCode: 400 });
      await client.query(`INSERT INTO provider_location_availability (provider_id, location_id, day_of_week, is_available, start_time, end_time) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (provider_id, location_id, day_of_week) DO UPDATE SET is_available=EXCLUDED.is_available,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time`, [req.params.id, locationId, Number(item.dayOfWeek), Boolean(item.isAvailable), item.startTime, item.endTime]);
    }
  });
  res.json({ ok: true });
});

providersRouter.post('/:id/unavailable', authRequired(['provider', 'admin']), async (req, res) => {
  if (req.user.role === 'provider' && !(await query(`SELECT id FROM providers WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id])).rows[0]) return res.status(403).json({ error: 'Not allowed' });
  const locationId = null, date = String(req.body.date || ''), startTime = req.body.startTime || null, endTime = req.body.endTime || null, reason = String(req.body.reason || '').slice(0, 200);
  if (!date) return res.status(400).json({ error: 'Date is required' });
  const result = startTime && endTime
    ? await query(`INSERT INTO provider_unavailable_slots (provider_id, location_id, unavailable_date, start_time, end_time, reason) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [req.params.id, locationId, date, startTime, endTime, reason || null])
    : await query(`INSERT INTO provider_unavailable_days (provider_id, location_id, unavailable_date, reason) VALUES ($1,$2,$3,$4) ON CONFLICT (provider_id, location_id, unavailable_date) DO UPDATE SET reason=EXCLUDED.reason RETURNING *`, [req.params.id, locationId, date, reason || null]);
  res.status(201).json({ unavailable: result.rows[0] });
});

providersRouter.patch('/:id/status', authRequired(['provider', 'admin']), async (req, res) => {
  const online = Boolean(req.body.isOnline);
  if (req.user.role === 'provider') {
    const owner = await query(`SELECT id FROM providers WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    if (!owner.rows[0]) return res.status(403).json({ error: 'Not allowed' });
  }
  const result = await query(
    `UPDATE providers SET is_online = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, is_online`,
    [online, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Provider not found' });
  await query(
    `INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [req.user.id, req.user.name || req.user.email || req.user.role, req.user.role, online ? 'Provider went online' : 'Provider went offline', JSON.stringify({ providerId: req.params.id })]
  );
  res.json({ provider: result.rows[0] });
});

providersRouter.patch('/:id/profile', authRequired(['provider', 'admin']), async (req, res, next) => {
  try {
  if (req.body.fullAddress !== undefined && (typeof req.body.fullAddress !== 'string' || req.body.fullAddress.length > 1000)) return res.status(400).json({ error: 'Full address must be text of at most 1000 characters' });
  const fullName = String(req.body.fullName || '').trim().slice(0, 100);
  const requestedEmail = String(req.body.email || '').trim().toLowerCase().slice(0, 254);
  const mobile = String(req.body.mobile || '').trim().slice(0, 30);
  const professionalTitle = String(req.body.professionalTitle || '').trim().slice(0, 100) || 'Provider';
  const duration = [30, 60, 90, 120].includes(Number(req.body.durationMinutes)) ? Number(req.body.durationMinutes) : 60;
  const bio = String(req.body.bio || '').trim().slice(0, 500) || null;
  const requestedLocations = Array.isArray(req.body.locations) ? [...new Set(req.body.locations.map((value) => String(value || '').trim()).filter(Boolean))] : [];
  if (!fullName || !requestedLocations.length) return res.status(400).json({ error: 'Name and at least one practice location are required' });
  if (req.user.role === 'admin' && (!requestedEmail || !requestedEmail.includes('@'))) return res.status(400).json({ error: 'A valid email address is required' });

  const provider = await withTransaction(async (client) => {
    const currentResult = await client.query(
    `SELECT p.id, p.user_id, u.email, u.mobile
       FROM providers p JOIN app_users u ON u.id = p.user_id
       WHERE p.id = $1
       FOR UPDATE`,
      [req.params.id]
    );
    const current = currentResult.rows[0];
    if (!current) return null;
    if (req.user.role === 'provider' && current.user_id !== req.user.id) {
      const error = new Error('Not allowed');
      error.statusCode = 403;
      throw error;
    }
    const email = req.user.role === 'admin' ? requestedEmail : current.email;
    const duplicate = await client.query(`SELECT id FROM app_users WHERE lower(email) = lower($1) AND id <> $2`, [email, current.user_id]);
    if (duplicate.rows[0]) {
      const error = new Error('That email address is already registered');
      error.statusCode = 409;
      throw error;
    }
    const locations = await client.query(`SELECT id, name FROM locations WHERE name = ANY($1::text[]) AND is_active = true`, [requestedLocations]);
    if (locations.rows.length !== requestedLocations.length) {
      const error = new Error('One or more practice locations are invalid');
      error.statusCode = 400;
      throw error;
    }
    const emailChanged = current.email.toLowerCase() !== email;
    const mobileChanged = String(current.mobile || '') !== mobile;
    const adminContactChanged = req.user.role === 'admin' && (emailChanged || mobileChanged);
    await client.query(
      `UPDATE app_users
       SET full_name = $1, email = $2, mobile = $3,
           email_verified_at = CASE WHEN lower(email) <> lower($2) THEN NULL ELSE email_verified_at END,
           mobile_verified_at = CASE WHEN COALESCE(mobile, '') <> $3 THEN NULL ELSE mobile_verified_at END,
           auth_version = auth_version + CASE WHEN $5 THEN 1 ELSE 0 END,
           updated_at = now()
       WHERE id = $4`,
      [fullName, email, mobile, current.user_id, adminContactChanged]
    );
    await client.query(
      `UPDATE providers SET title = $1, professional_title = $2, specialty = $3, sub_specialties = $4, medical_registration_number = $5, practice_number = $6, practice_setting = $7, private_practice_name = $8, default_duration_minutes = $9, bio = $10, updated_at = now() WHERE id = $11`,
      [String(req.body.title || '').trim().slice(0, 20) || null, professionalTitle, String(req.body.specialty || '').trim().slice(0, 100) || null, Array.isArray(req.body.subSpecialties) ? req.body.subSpecialties.map((v) => String(v).trim()).filter(Boolean).slice(0, 20) : [], String(req.body.medicalRegistrationNumber || '').trim().slice(0, 80) || null, String(req.body.practiceNumber || '').trim().slice(0, 80) || null, String(req.body.practiceSetting || '').trim().slice(0, 80) || null, String(req.body.privatePracticeName || '').trim().slice(0, 150) || null, duration, bio, current.id]
    );
    await client.query(`DELETE FROM provider_locations WHERE provider_id = $1`, [current.id]);
    if (req.body.fullAddress !== undefined) await client.query('UPDATE providers SET full_address=$1 WHERE id=$2', [req.body.fullAddress.trim() || null, current.id]);
    for (const location of locations.rows) await client.query(`INSERT INTO provider_locations (provider_id, location_id) VALUES ($1, $2)`, [current.id, location.id]);
    if (emailChanged || mobileChanged) await client.query(`UPDATE trusted_devices SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [current.user_id]);
    if (adminContactChanged) await client.query(`UPDATE auth_otp_challenges SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL`, [current.user_id]);
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
       VALUES ($1, $2, $3, 'Updated provider profile', $4::jsonb)`,
      [req.user.id, req.user.name || req.user.email || req.user.role, req.user.role, JSON.stringify({ providerId: current.id, emailChanged, mobileChanged })]
    );
    return { id: current.id };
  });
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  res.json({ provider });
  } catch (error) { next(error); }
});

providersRouter.patch('/:id/deactivate', authRequired(['admin']), async (req, res) => {
  const provider = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT p.id, p.user_id, u.full_name, u.email, u.is_active
       FROM providers p
       JOIN app_users u ON u.id = p.user_id
       WHERE p.id = $1
       FOR UPDATE`,
      [req.params.id]
    );
    const account = result.rows[0];
    if (!account) return null;

    await client.query(
      `UPDATE app_users SET is_active = false, auth_version = auth_version + 1, updated_at = now() WHERE id = $1`,
      [account.user_id]
    );
    await client.query(`UPDATE trusted_devices SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [account.user_id]);
    await client.query(`UPDATE auth_otp_challenges SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL`, [account.user_id]);
    await client.query(
      `UPDATE providers SET is_online = false, updated_at = now() WHERE id = $1`,
      [account.id]
    );
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
       VALUES ($1, $2, $3, 'Deactivated provider', $4::jsonb)`,
      [req.user.id, req.user.name || req.user.email || 'Administrator', req.user.role,
        JSON.stringify({ providerId: account.id, providerUserId: account.user_id, email: account.email })]
    );

    return { id: account.id, fullName: account.full_name, email: account.email, isActive: false };
  });

  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  res.json({ provider });
});

providersRouter.patch('/:id/reactivate', authRequired(['admin']), async (req, res) => {
  const provider = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT p.id, p.user_id, u.full_name, u.email
       FROM providers p
       JOIN app_users u ON u.id = p.user_id
       WHERE p.id = $1 AND u.registration_status = 'approved'
       FOR UPDATE`,
      [req.params.id]
    );
    const account = result.rows[0];
    if (!account) return null;

    await client.query(
      `UPDATE app_users SET is_active = true, updated_at = now() WHERE id = $1`,
      [account.user_id]
    );
    await client.query(
      `UPDATE providers SET is_online = false, updated_at = now() WHERE id = $1`,
      [account.id]
    );
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, details)
       VALUES ($1, $2, $3, 'Reactivated provider', $4::jsonb)`,
      [req.user.id, req.user.name || req.user.email || 'Administrator', req.user.role,
        JSON.stringify({ providerId: account.id, providerUserId: account.user_id, email: account.email })]
    );

    return { id: account.id, fullName: account.full_name, email: account.email, isActive: true };
  });

  if (!provider) return res.status(404).json({ error: 'Approved provider not found' });
  res.json({ provider });
});

providersRouter.put('/:id/availability', authRequired(['provider', 'admin']), async (req, res) => {
  const availability = Array.isArray(req.body.availability) ? req.body.availability : [];
  if (availability.length !== 7) return res.status(400).json({ error: 'All seven availability days are required' });

  if (req.user.role === 'provider') {
    const owner = await query(`SELECT id FROM providers WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    if (!owner.rows[0]) return res.status(403).json({ error: 'Not allowed' });
  }

  await withTransaction(async (client) => {
    for (const item of availability) {
      const day = Number(item.dayOfWeek);
      if (!Number.isInteger(day) || day < 0 || day > 6 || !item.startTime || !item.endTime) {
        const error = new Error('Invalid availability entry');
        error.statusCode = 400;
        throw error;
      }
      await client.query(
        `INSERT INTO provider_availability (provider_id, day_of_week, is_available, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (provider_id, day_of_week)
         DO UPDATE SET is_available = EXCLUDED.is_available, start_time = EXCLUDED.start_time,
                       end_time = EXCLUDED.end_time, updated_at = now()`,
        [req.params.id, day, Boolean(item.isAvailable), item.startTime, item.endTime]
      );
    }
  });

  res.json({ ok: true });
});
