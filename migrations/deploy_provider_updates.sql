-- Provider reminders, profile address and cancellation policy deployment.
-- Run against the intended LIVE database, using the application's database role
-- or a role that can create tables and alter existing providers.
-- Existing policy text, settings, appointments and other data are preserved.
-- This script changes database structure only; deploy the application code too.
-- Repeatable for the migrations in this release; incompatible existing schemas
-- are not repaired automatically. No reminders are enabled by this script.

BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY['app_users','providers','patients','appointments'] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'Required table public.% is missing. Run this script on the existing bookings database.', required_table;
    END IF;
  END LOOP;
  IF to_regprocedure('gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'gen_random_uuid() is unavailable. The bookings database UUID prerequisite must be installed first.';
  END IF;
END $$;

-- Source: migrations/011_reminder_templates.sql
CREATE TABLE IF NOT EXISTS reminder_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  language text NOT NULL CHECK (language IN ('en', 'af')),
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  subject text NOT NULL DEFAULT '',
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 1000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name, language, channel)
);

-- Source: migrations/012_automatic_reminders.sql
CREATE TABLE IF NOT EXISTS provider_reminder_settings (
  provider_id uuid PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  offsets integer[] NOT NULL DEFAULT '{}',
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','af')),
  templates jsonb NOT NULL,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (offsets <@ ARRAY[15,30,1440])
);
CREATE TABLE IF NOT EXISTS automatic_reminder_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id),
  starts_at timestamptz NOT NULL,
  offset_minutes integer NOT NULL,
  recipient_kind text NOT NULL CHECK (recipient_kind IN ('patient','provider')),
  recipient text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('sending','sent','failed','skipped')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (appointment_id, patient_id, starts_at, offset_minutes, recipient_kind)
);
CREATE INDEX IF NOT EXISTS automatic_reminder_provider_history ON automatic_reminder_deliveries(provider_id, created_at DESC);

-- Source: migrations/013_provider_full_address.sql
ALTER TABLE providers ADD COLUMN IF NOT EXISTS full_address text;

-- Source: migrations/014_provider_cancellation_policy.sql
ALTER TABLE providers ADD COLUMN IF NOT EXISTS cancellation_policy text;

-- Source: migrations/015_cancellation_policy_format.sql
ALTER TABLE providers ADD COLUMN IF NOT EXISTS cancellation_policy_format text NOT NULL DEFAULT 'text';

-- If you run as an administrator instead of the backend's database role,
-- grant the new tables to that backend role before restarting the application.
-- Replace YOUR_BACKEND_ROLE in this example, then run it if needed:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
--   public.reminder_templates, public.provider_reminder_settings,
--   public.automatic_reminder_deliveries TO YOUR_BACKEND_ROLE;

COMMIT;

-- Confirm the deployment results.
SELECT current_database() AS database_name,
       to_regclass('public.reminder_templates') AS reminder_templates,
       to_regclass('public.provider_reminder_settings') AS provider_reminder_settings,
       to_regclass('public.automatic_reminder_deliveries') AS automatic_reminder_deliveries;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'providers'
  AND column_name IN ('full_address', 'cancellation_policy', 'cancellation_policy_format')
ORDER BY column_name;
