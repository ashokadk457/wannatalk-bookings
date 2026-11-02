-- A date override has priority over the recurring weekly schedule.
CREATE TABLE IF NOT EXISTS provider_availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  location_id uuid NULL REFERENCES locations(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  availability_type text NOT NULL CHECK (availability_type IN ('Available', 'Unavailable')),
  online_booking_enabled boolean NOT NULL DEFAULT false,
  start_time time NULL,
  end_time time NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((start_time IS NULL AND end_time IS NULL) OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);

CREATE INDEX IF NOT EXISTS provider_availability_overrides_lookup_idx
  ON provider_availability_overrides(provider_id, override_date);

-- Safe when the initial version of this migration was already applied.
ALTER TABLE provider_availability_overrides
  ADD COLUMN IF NOT EXISTS online_booking_enabled boolean NOT NULL DEFAULT false;
