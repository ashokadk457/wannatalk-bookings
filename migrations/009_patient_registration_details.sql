BEGIN;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS preferred_otp_method TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_users_preferred_otp_method_check'
  ) THEN
    ALTER TABLE app_users
      ADD CONSTRAINT app_users_preferred_otp_method_check
      CHECK (preferred_otp_method IS NULL OR preferred_otp_method IN ('email', 'sms'));
  END IF;
END $$;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS identity_document_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS patient_consent_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;

COMMIT;
