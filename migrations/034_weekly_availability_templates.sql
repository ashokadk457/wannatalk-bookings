CREATE TABLE IF NOT EXISTS provider_availability_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name text NOT NULL,
  weekly_availability jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_availability_templates_provider_idx
  ON provider_availability_templates(provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS provider_availability_templates_one_active
  ON provider_availability_templates(provider_id) WHERE is_active;
