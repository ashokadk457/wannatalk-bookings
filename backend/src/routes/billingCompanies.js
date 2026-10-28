import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';

export const billingCompaniesRouter = Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function input(body) {
  const text = (value, max) => String(value || '').trim().slice(0, max) || null;
  const registeredName = text(body.registeredName, 200);
  const billingEmail = text(body.billingEmail, 254);
  const vatRegistered = Boolean(body.vatRegistered), vatNumber = text(body.vatNumber, 80);
  const paymentTermsDays = Number(body.paymentTermsDays ?? 30);
  const patientIds = Array.isArray(body.patientIds) ? [...new Set(body.patientIds.map((id) => String(id || '').trim()).filter(Boolean))] : [];
  if (!registeredName) throw Object.assign(new Error('Registered company name is required'), { statusCode: 400 });
  if (billingEmail && !emailPattern.test(billingEmail)) throw Object.assign(new Error('Enter a valid billing email address'), { statusCode: 400 });
  if (vatRegistered && !vatNumber) throw Object.assign(new Error('VAT number is required for a VAT-registered company'), { statusCode: 400 });
  if (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365) throw Object.assign(new Error('Payment terms must be between 0 and 365 days'), { statusCode: 400 });
  return {
    registeredName, tradingName:text(body.tradingName,200), companyRegistrationNumber:text(body.companyRegistrationNumber,80),
    vatRegistered, vatNumber, accountsContactName:text(body.accountsContactName,150), billingEmail,
    phone:text(body.phone,40), billingAddress:text(body.billingAddress,1000), paymentTermsDays,
    purchaseOrderRequired:Boolean(body.purchaseOrderRequired), defaultPurchaseOrderReference:text(body.defaultPurchaseOrderReference,150),
    notes:text(body.notes,2000), patientIds,
  };
}

async function replacePatients(client, companyId, patientIds) {
  if (patientIds.length) {
    const valid = await client.query(`SELECT id FROM patients WHERE id = ANY($1::uuid[])`, [patientIds]);
    if (valid.rows.length !== patientIds.length) throw Object.assign(new Error('One or more selected patients are invalid'), { statusCode: 400 });
  }
  await client.query(`DELETE FROM billing_company_patients WHERE company_id = $1`, [companyId]);
  for (const patientId of patientIds) await client.query(`INSERT INTO billing_company_patients (company_id, patient_id) VALUES ($1,$2)`, [companyId, patientId]);
}

billingCompaniesRouter.get('/', authRequired(['admin','provider']), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT c.*,
            COALESCE(array_agg(cp.patient_id) FILTER (WHERE cp.patient_id IS NOT NULL AND ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM appointments a JOIN providers own ON own.id=a.provider_id WHERE own.user_id=$1 AND a.patient_id=cp.patient_id))), '{}') AS patient_ids,
            COUNT(cp.patient_id) FILTER (WHERE $1::uuid IS NULL OR EXISTS(SELECT 1 FROM appointments a JOIN providers own ON own.id=a.provider_id WHERE own.user_id=$1 AND a.patient_id=cp.patient_id))::integer AS patient_count
     FROM billing_companies c
     LEFT JOIN billing_company_patients cp ON cp.company_id = c.id
     WHERE $1::uuid IS NULL OR EXISTS(SELECT 1 FROM billing_company_patients scoped JOIN appointments a ON a.patient_id=scoped.patient_id JOIN providers own ON own.id=a.provider_id WHERE scoped.company_id=c.id AND own.user_id=$1)
     GROUP BY c.id ORDER BY c.registered_name`,
    [req.user.role==='provider'?req.user.id:null]
  );
  res.json({ companies: result.rows });
}));

billingCompaniesRouter.post('/', authRequired(['admin']), asyncHandler(async (req, res) => {
  const data = input(req.body);
  const company = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO billing_companies
       (registered_name,trading_name,company_registration_number,vat_registered,vat_number,accounts_contact_name,billing_email,phone,billing_address,payment_terms_days,purchase_order_required,default_purchase_order_reference,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [data.registeredName,data.tradingName,data.companyRegistrationNumber,data.vatRegistered,data.vatNumber,data.accountsContactName,data.billingEmail,data.phone,data.billingAddress,data.paymentTermsDays,data.purchaseOrderRequired,data.defaultPurchaseOrderReference,data.notes]
    );
    await replacePatients(client, result.rows[0].id, data.patientIds);
    await client.query(`INSERT INTO audit_logs (user_id,user_name,user_role,action,details) VALUES ($1,$2,$3,'Created billing company',$4::jsonb)`, [req.user.id,req.user.name||req.user.email||'Administrator',req.user.role,JSON.stringify({companyId:result.rows[0].id,registeredName:data.registeredName})]);
    return { ...result.rows[0], patient_ids:data.patientIds, patient_count:data.patientIds.length };
  });
  res.status(201).json({ company });
}));

billingCompaniesRouter.put('/:id', authRequired(['admin']), asyncHandler(async (req, res) => {
  const data = input(req.body);
  const company = await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE billing_companies SET registered_name=$1,trading_name=$2,company_registration_number=$3,vat_registered=$4,vat_number=$5,accounts_contact_name=$6,billing_email=$7,phone=$8,billing_address=$9,payment_terms_days=$10,purchase_order_required=$11,default_purchase_order_reference=$12,notes=$13,updated_at=now()
       WHERE id=$14 RETURNING *`,
      [data.registeredName,data.tradingName,data.companyRegistrationNumber,data.vatRegistered,data.vatNumber,data.accountsContactName,data.billingEmail,data.phone,data.billingAddress,data.paymentTermsDays,data.purchaseOrderRequired,data.defaultPurchaseOrderReference,data.notes,req.params.id]
    );
    if (!result.rows[0]) return null;
    await replacePatients(client, req.params.id, data.patientIds);
    await client.query(`INSERT INTO audit_logs (user_id,user_name,user_role,action,details) VALUES ($1,$2,$3,'Updated billing company',$4::jsonb)`, [req.user.id,req.user.name||req.user.email||'Administrator',req.user.role,JSON.stringify({companyId:req.params.id,registeredName:data.registeredName})]);
    return { ...result.rows[0], patient_ids:data.patientIds, patient_count:data.patientIds.length };
  });
  if (!company) return res.status(404).json({ error:'Company not found' });
  res.json({ company });
}));

billingCompaniesRouter.patch('/:id/status', authRequired(['admin']), asyncHandler(async (req, res) => {
  const isActive = Boolean(req.body.isActive);
  const result = await query(`UPDATE billing_companies SET is_active=$1,updated_at=now() WHERE id=$2 RETURNING *`, [isActive,req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error:'Company not found' });
  await query(`INSERT INTO audit_logs (user_id,user_name,user_role,action,details) VALUES ($1,$2,$3,$4,$5::jsonb)`, [req.user.id,req.user.name||req.user.email||'Administrator',req.user.role,isActive?'Reactivated billing company':'Deactivated billing company',JSON.stringify({companyId:req.params.id})]);
  res.json({ company:result.rows[0] });
}));
