CREATE TABLE IF NOT EXISTS reminder_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  language text NOT NULL CHECK (language IN ('en', 'af')),
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  subject text NOT NULL DEFAULT '',
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 1000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name, language, channel)
);
