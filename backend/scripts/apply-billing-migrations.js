import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const migrations = [
  '016_provider_billing_profiles.sql',
  '017_billing_companies.sql',
  '018_billing_invoice_upgrade.sql',
  '019_billing_phase2.sql',
];

try {
  for (const migration of migrations) {
    const path = fileURLToPath(new URL(`../../migrations/${migration}`, import.meta.url));
    await pool.query(await readFile(path, 'utf8'));
    console.log(`Applied ${migration}`);
  }
} finally { await pool.end(); }
