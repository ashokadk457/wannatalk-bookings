BEGIN;

ALTER TABLE provider_billing_profiles
  ADD COLUMN IF NOT EXISTS quote_next_number BIGINT NOT NULL DEFAULT 1 CHECK(quote_next_number > 0);

CREATE TABLE IF NOT EXISTS billing_quotes(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL,
  provider_id UUID NOT NULL REFERENCES providers(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  company_id UUID REFERENCES billing_companies(id),
  billing_customer_type TEXT NOT NULL DEFAULT 'patient' CHECK(billing_customer_type IN('patient','company')),
  status TEXT NOT NULL DEFAULT 'Issued' CHECK(status IN('Issued','Void')),
  issuer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by_user_id UUID REFERENCES app_users(id),
  deleted_at TIMESTAMPTZ,
  deleted_by_user_id UUID REFERENCES app_users(id),
  deleted_by_name TEXT,
  deletion_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_id,quote_number)
);

CREATE TABLE IF NOT EXISTS billing_quote_items(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES billing_quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  service_date DATE,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK(quantity > 0),
  rate NUMERIC(12,2) NOT NULL CHECK(rate >= 0),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(tax_amount >= 0),
  amount NUMERIC(12,2) NOT NULL CHECK(amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_quotes_provider_issue_idx ON billing_quotes(provider_id,issue_date DESC);

COMMIT;
