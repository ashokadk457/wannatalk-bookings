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
