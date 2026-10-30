import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const migrations = [
  '016_provider_billing_profiles.sql',
  '017_billing_companies.sql',
  '018_billing_invoice_upgrade.sql',
  '019_billing_phase2.sql',
  '026_billing_simplified_workflow.sql',
  '031_default_bank_account.sql',
  '032_invoice_edit_history.sql',
  '033_statement_download_links.sql',
  '034_quotes.sql',
  '035_weekly_online_booking.sql',
  '036_weekly_schedule_templates.sql',
];

try {
  for (const migration of migrations) {
    const path = fileURLToPath(new URL(`../../migrations/${migration}`, import.meta.url));
    await pool.query(await readFile(path, 'utf8'));
    console.log(`Applied ${migration}`);
  }
} finally { await pool.end(); }
