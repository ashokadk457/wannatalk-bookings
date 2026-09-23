BEGIN;

-- Add new columns to app_users table for patient registration
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS id_or_passport_number TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'South Africa',
  ADD COLUMN IF NOT EXISTS otp_authentication_method TEXT CHECK (otp_authentication_method IN ('email', 'phone')),
  ADD COLUMN IF NOT EXISTS patient_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted BOOLEAN NOT NULL DEFAULT FALSE;

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS app_users_id_or_passport_idx ON app_users (id_or_passport_number) WHERE id_or_passport_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_users_nationality_idx ON app_users (nationality);

-- Update existing patients to have default values for new required fields
-- This ensures existing records remain valid
UPDATE app_users
SET nationality = 'South Africa'
WHERE role = 'patient' AND nationality IS NULL;

COMMIT;