# WannaTalk Bookings API

Backend API for the WannaTalk booking dashboard. The browser must call this API instead of connecting directly to PostgreSQL.

## Setup

```bash
cd backend
cp .env.example .env
npm install
npm run start
```

Update `.env` with the real PostgreSQL password, a long random `JWT_SECRET`, and a separate long random `PII_ENCRYPTION_KEY`. The latter encrypts patient ID/passport numbers at rest; retain it securely because encrypted values cannot be recovered after the key is lost.

## First Passwords

The seed migration creates demo users without passwords. Set passwords like this:

```bash
node scripts/set-password.js admin@wannatalk.co.za "new-password"
node scripts/set-password.js louw@wannatalk.co.za "new-password"
node scripts/set-password.js sarah@test.co.za "new-password"
```

## Reminder templates

Apply `../migrations/011_reminder_templates.sql` to the configured database before using the reminder template library. Templates are saved per signed-in admin/provider, language (English/Afrikaans), and channel (Email/SMS). Each combination supports multiple named templates. Save changes updates the selected template; Save as new template creates another entry. Sending a draft does not save it. WhatsApp uses the SMS draft.

The Appointment reminders page continues to select patients. Each patient receives one reminder using their first upcoming appointment in the filtered list. Email and SMS bodies are rendered independently, including email subject placeholders. Unresolved fields block sending before deliveries start.

Template API: `GET/POST /api/reminder-templates`, `PUT /api/reminder-templates/:id`. Run content checks with `node --test tests/reminder-content.test.js` from `backend`.

## Automatic email reminders

Apply `../migrations/012_automatic_reminders.sql`. Providers configure `/provider/automatic-reminders`; the protected API is `GET/PUT /api/automatic-reminders`. Automatic reminders default to off. Providers select 24 hours, 30 minutes and/or 15 minutes and save separate patient/provider email templates in English and Afrikaans. The selected sending language applies to both recipients.

The backend starts a worker automatically and polls every 30 seconds while the process is running. Set `APPOINTMENT_TIMEZONE=Africa/Johannesburg` (default) to interpret appointment date/time. Run the backend under your existing process supervisor with automatic restart for continuous operation. Alternatively set `AUTOMATIC_REMINDERS_WORKER=false` on the API and run `npm run reminder-worker` under a supervisor as a separate service. Deploy the migration before restarting either process.

Only active accounts with Booked/Confirmed future appointments and opted-in provider settings qualify. The worker catches reminders due within the last five minutes, provided they became due after opt-in; older missed reminders are skipped. Cancelled appointments and changed times are rechecked before claiming a delivery. A rescheduled appointment has a new schedule identity. Persistent per-recipient claims and a database advisory lock suppress duplicates across ticks, restarts and multiple workers.

Email delivery is at-most-once per appointment schedule/time/recipient. Failed deliveries are logged and not automatically retried, since an SMTP timeout may mean the email was already accepted. A process crash after claiming can leave a `sending` record for review; it will not be resent automatically. Provider history lists the latest 50 deliveries. Database failures are logged and the worker checks again on its next tick. No browser needs to remain open.

Checks: `node tests/automatic-reminder-content.test.js`. Explicit DB integration check: `node tests/automatic-reminder-worker.integration.js` (uses temporary tables, rolls back fixtures and mocks SMTP).

## Main Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/mfa/send`
- `POST /api/auth/mfa/verify`
- `GET /api/providers`
- `GET /api/providers/:id/availability`
- `PUT /api/providers/:id/availability`
- `PATCH /api/providers/:id/status`
- `GET /api/patients`
- `GET /api/locations`
- `GET /api/appointments`
- `POST /api/appointments`
- `PATCH /api/appointments/:id/reschedule`
- `PATCH /api/appointments/:id/status`
- `DELETE /api/appointments/:id`
- `GET /api/appointments/:id/invoice`
- `GET /api/appointments/:id/invoice/pdf`
- `POST /api/appointments/:id/invoice/email`
- `GET /api/audit-logs`
- `GET /api/registrations`
- `PATCH /api/registrations/:id/approve`
- `PATCH /api/registrations/:id/reject`
