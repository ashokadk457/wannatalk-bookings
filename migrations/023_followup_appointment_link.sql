BEGIN;

ALTER TABLE follow_ups
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS follow_ups_appointment_sent_idx
  ON follow_ups(appointment_id, reminder_sent_at)
  WHERE appointment_id IS NOT NULL;

COMMIT;
