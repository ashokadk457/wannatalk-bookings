BEGIN;

ALTER TABLE application_follow_up_settings
  ADD COLUMN IF NOT EXISTS first_send_after_value INTEGER NOT NULL DEFAULT 1 CHECK (first_send_after_value BETWEEN 0 AND 365),
  ADD COLUMN IF NOT EXISTS first_send_after_unit TEXT NOT NULL DEFAULT 'days' CHECK (first_send_after_unit IN ('days','weeks','months')),
  ADD COLUMN IF NOT EXISTS repeat_every_value INTEGER NOT NULL DEFAULT 1 CHECK (repeat_every_value BETWEEN 1 AND 365),
  ADD COLUMN IF NOT EXISTS repeat_every_unit TEXT NOT NULL DEFAULT 'weeks' CHECK (repeat_every_unit IN ('days','weeks','months')),
  ADD COLUMN IF NOT EXISTS send_time TIME NOT NULL DEFAULT '09:00';

UPDATE application_follow_up_settings
SET first_send_after_value=first_send_after_days,
    first_send_after_unit='days',
    repeat_every_value=repeat_every_days,
    repeat_every_unit='days'
WHERE updated_at IS NOT NULL;

COMMIT;
