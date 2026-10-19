BEGIN;

ALTER TABLE follow_ups
  ADD COLUMN IF NOT EXISTS reminder_schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_schedule_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_schedule_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reminder_schedule_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS follow_ups_due_schedule_idx
  ON follow_ups(due_at)
  WHERE reminder_schedule_enabled = true;

COMMIT;
