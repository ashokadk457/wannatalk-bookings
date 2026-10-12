import 'dotenv/config';
import { startAutomaticReminders } from '../src/automaticReminders.js';
import { pool } from '../src/db.js';
const stop = startAutomaticReminders();
console.log('Automatic email reminder worker running (30-second polling).');
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => {stop();await pool.end();process.exit(0);});
