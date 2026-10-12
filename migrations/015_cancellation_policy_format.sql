ALTER TABLE providers ADD COLUMN IF NOT EXISTS cancellation_policy_format text NOT NULL DEFAULT 'text';
