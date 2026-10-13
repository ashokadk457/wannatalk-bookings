BEGIN;

CREATE TABLE IF NOT EXISTS billing_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registered_name TEXT NOT NULL,
  trading_name TEXT,
  company_registration_number TEXT,
  vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
  vat_number TEXT,
  accounts_contact_name TEXT,
  billing_email TEXT,
  phone TEXT,
  billing_address TEXT,
  payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 365),
  purchase_order_required BOOLEAN NOT NULL DEFAULT FALSE,
  default_purchase_order_reference TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_company_patients (
  company_id UUID NOT NULL REFERENCES billing_companies(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, patient_id)
);

CREATE INDEX IF NOT EXISTS billing_companies_name_idx ON billing_companies(registered_name);
CREATE INDEX IF NOT EXISTS billing_company_patients_patient_idx ON billing_company_patients(patient_id);

COMMIT;
