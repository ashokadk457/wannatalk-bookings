BEGIN;

ALTER TABLE provider_location_availability
  ADD COLUMN IF NOT EXISTS online_booking_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve the current provider-wide setting for existing active weekly slots.
-- New and edited schedules are controlled exclusively per weekday/location row.
UPDATE provider_location_availability pla
SET online_booking_enabled = TRUE
FROM providers p
WHERE p.id = pla.provider_id
  AND pla.is_available = TRUE
  AND p.is_online = TRUE;

COMMIT;
