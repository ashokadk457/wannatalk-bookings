CREATE TABLE IF NOT EXISTS provider_location_availability (
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_available boolean NOT NULL DEFAULT false,
  start_time time NOT NULL,
  end_time time NOT NULL,
  PRIMARY KEY (provider_id, location_id, day_of_week), CHECK (end_time > start_time)
);
CREATE TABLE IF NOT EXISTS provider_unavailable_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE, unavailable_date date NOT NULL, reason text,
  UNIQUE (provider_id, location_id, unavailable_date)
);
CREATE TABLE IF NOT EXISTS provider_unavailable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE, unavailable_date date NOT NULL, start_time time NOT NULL, end_time time NOT NULL, reason text,
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_provider_location_availability_lookup ON provider_location_availability(provider_id, location_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_provider_unavailable_days_lookup ON provider_unavailable_days(provider_id, unavailable_date);
CREATE INDEX IF NOT EXISTS idx_provider_unavailable_slots_lookup ON provider_unavailable_slots(provider_id, unavailable_date);
