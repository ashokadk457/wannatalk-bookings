BEGIN;

CREATE TABLE IF NOT EXISTS application_follow_up_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled BOOLEAN NOT NULL DEFAULT false,
  first_send_after_days INTEGER NOT NULL DEFAULT 1 CHECK (first_send_after_days BETWEEN 0 AND 365),
  repeat_every_days INTEGER NOT NULL DEFAULT 7 CHECK (repeat_every_days BETWEEN 1 AND 365),
  max_sends INTEGER NOT NULL DEFAULT 1 CHECK (max_sends BETWEEN 1 AND 12),
  applies_to_appointments_from DATE NOT NULL DEFAULT CURRENT_DATE,
  reminder_channels TEXT[] NOT NULL DEFAULT ARRAY['email']::TEXT[],
  reminder_message TEXT NOT NULL DEFAULT 'WannaTalk reminder: please contact us to arrange your recommended follow-up session.',
  updated_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  enabled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cardinality(reminder_channels) > 0),
  CHECK (reminder_channels <@ ARRAY['email', 'sms', 'whatsapp']::TEXT[])
);

CREATE TABLE IF NOT EXISTS application_follow_up_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  send_number INTEGER NOT NULL CHECK (send_number BETWEEN 1 AND 12),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  delivery_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  UNIQUE (appointment_id, send_number)
);

CREATE INDEX IF NOT EXISTS application_follow_up_delivery_history_idx
  ON application_follow_up_deliveries(created_at DESC);

COMMIT;
