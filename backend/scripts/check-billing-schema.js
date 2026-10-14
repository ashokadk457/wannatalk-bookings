import 'dotenv/config';
import { pool } from '../src/db.js';

try {
  const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])`, [['provider_billing_profiles','billing_companies','billing_company_patients','invoices','invoice_items','billing_payments','billing_payment_allocations','billing_credit_notes']]);
  console.log('tables', tables.rows.map(row => row.table_name));
  const columns = await pool.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_name = ANY($1::text[]) AND column_name = ANY($2::text[]) ORDER BY table_name,column_name`, [['invoices','invoice_items'],['provider_id','issuer_snapshot','customer_snapshot','service_date','rate']]);
  console.log('columns', columns.rows);
  const profiles = await pool.query(`SELECT count(*)::int total,count(*) FILTER(WHERE registered_business_name IS NOT NULL)::int configured FROM provider_billing_profiles`);
  console.log('billing profiles', profiles.rows[0]);
} finally { await pool.end(); }
