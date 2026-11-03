BEGIN;

ALTER TABLE recurring_booking_series
  ADD COLUMN IF NOT EXISTS end_date DATE;

UPDATE recurring_booking_series AS series
SET end_date = COALESCE(
  (
    SELECT MAX(occurrence.appointment_date)
    FROM recurring_booking_occurrences AS occurrence
    WHERE occurrence.series_id = series.id
  ),
  series.start_date
)
WHERE series.end_date IS NULL;

ALTER TABLE recurring_booking_series
  ALTER COLUMN end_date SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recurring_booking_series_end_date_check'
  ) THEN
    ALTER TABLE recurring_booking_series
      ADD CONSTRAINT recurring_booking_series_end_date_check
      CHECK (end_date >= start_date);
  END IF;
END $$;

COMMIT;
