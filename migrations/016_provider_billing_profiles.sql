BEGIN;

CREATE TABLE IF NOT EXISTS provider_billing_profiles (
  provider_id UUID PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
  registered_business_name TEXT,
  trading_name TEXT,
  company_registration_number TEXT,
  vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
  vat_number TEXT,
  business_address TEXT,
  billing_address TEXT,
  billing_phone TEXT,
  billing_email TEXT,
  bank_account_holder TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_type TEXT,
  bank_branch_code TEXT,
  remittance_instructions TEXT,
  logo_url TEXT,
  brand_primary_color TEXT NOT NULL DEFAULT '#087b5b',
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  invoice_next_number BIGINT NOT NULL DEFAULT 1 CHECK (invoice_next_number > 0),
  invoice_number_padding INTEGER NOT NULL DEFAULT 6 CHECK (invoice_number_padding BETWEEN 3 AND 12),
  payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 365),
  currency_code CHAR(3) NOT NULL DEFAULT 'ZAR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO provider_billing_profiles
  (provider_id, registered_business_name, business_address, billing_address, billing_phone, billing_email)
SELECT p.id, COALESCE(NULLIF(p.private_practice_name,''), NULLIF(u.full_name,''), 'Provider Practice'),
       p.full_address, p.full_address, u.mobile, u.email
FROM providers p
JOIN app_users u ON u.id=p.user_id
ON CONFLICT (provider_id) DO NOTHING;

COMMIT;
