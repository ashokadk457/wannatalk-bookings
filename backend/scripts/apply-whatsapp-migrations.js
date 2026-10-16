import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const migrations = [
  '020_whatsapp_inbound.sql',
  '021_whatsapp_delivery_channel.sql',
  '022_whatsapp_workflow_channels.sql',
  '023_followup_appointment_link.sql',
  '024_followup_send_attempt.sql',
];

try {
  for (const migration of migrations) {
    const path = fileURLToPath(new URL(`../../migrations/${migration}`, import.meta.url));
    await pool.query(await readFile(path, 'utf8'));
    console.log(`Applied ${migration}`);
  }
} finally {
  await pool.end();
}
