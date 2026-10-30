BEGIN;

CREATE TABLE IF NOT EXISTS provider_weekly_schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
  created_by_user_id UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_id, name)
);

CREATE TABLE IF NOT EXISTS provider_weekly_schedule_template_rows (
  template_id UUID NOT NULL REFERENCES provider_weekly_schedule_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  location_id UUID REFERENCES locations(id),
  is_available BOOLEAN NOT NULL DEFAULT FALSE,
  online_booking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  PRIMARY KEY(template_id, day_of_week),
  CHECK(end_time > start_time)
);

CREATE INDEX IF NOT EXISTS provider_weekly_schedule_templates_provider_idx ON provider_weekly_schedule_templates(provider_id, updated_at DESC);

COMMIT;
