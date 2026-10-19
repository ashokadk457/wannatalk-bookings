import 'dotenv/config';
import { startAutomaticReminders } from '../src/automaticReminders.js';
import { startScheduledFollowUps } from '../src/followUpScheduler.js';
import { pool } from '../src/db.js';
const stopAutomatic = startAutomaticReminders();
const stopFollowUps = startScheduledFollowUps();
console.log('Automatic appointment and follow-up reminder workers running (30-second polling).');
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => {stopAutomatic();stopFollowUps();await pool.end();process.exit(0);});
