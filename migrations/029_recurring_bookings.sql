BEGIN;

CREATE TABLE IF NOT EXISTS recurring_booking_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  provider_id UUID NOT NULL REFERENCES providers(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  created_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
  recurrence_interval INTEGER NOT NULL DEFAULT 1 CHECK (recurrence_interval BETWEEN 1 AND 52),
  recurrence_unit TEXT NOT NULL CHECK (recurrence_unit IN ('days','weeks','months')),
  occurrence_count INTEGER NOT NULL CHECK (occurrence_count BETWEEN 2 AND 104),
  appointment_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  note TEXT,
  intake_requested BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_booking_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES recurring_booking_series(id) ON DELETE CASCADE,
  occurrence_number INTEGER NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('booked','conflict','cancelled')),
  conflict_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(series_id, occurrence_number)
);

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS recurring_series_id UUID REFERENCES recurring_booking_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurring_occurrence_number INTEGER;

CREATE INDEX IF NOT EXISTS recurring_booking_series_patient_idx ON recurring_booking_series(patient_id, status);
CREATE INDEX IF NOT EXISTS recurring_booking_occurrences_series_idx ON recurring_booking_occurrences(series_id, appointment_date);
CREATE INDEX IF NOT EXISTS appointments_recurring_series_idx ON appointments(recurring_series_id, appointment_date);

COMMIT;
