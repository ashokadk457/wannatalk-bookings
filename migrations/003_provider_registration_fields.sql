ALTER TABLE providers ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS specialty text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS sub_specialties text[] NOT NULL DEFAULT '{}';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS medical_registration_number text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS practice_number text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS practice_setting text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS private_practice_name text;
