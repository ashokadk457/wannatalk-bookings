BEGIN;

ALTER TABLE provider_billing_profiles ADD COLUMN IF NOT EXISTS credit_note_next_number BIGINT NOT NULL DEFAULT 1 CHECK(credit_note_next_number>0);

CREATE TABLE IF NOT EXISTS billing_payments(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider_id UUID NOT NULL REFERENCES providers(id), patient_id UUID REFERENCES patients(id), company_id UUID REFERENCES billing_companies(id),
  customer_type TEXT NOT NULL CHECK(customer_type IN('patient','company')), payment_date DATE NOT NULL, amount NUMERIC(12,2) NOT NULL CHECK(amount>0),
  unallocated_amount NUMERIC(12,2) NOT NULL CHECK(unallocated_amount>=0), method TEXT NOT NULL, reference TEXT, notes TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN('Active','Reversed')), created_by_user_id UUID REFERENCES app_users(id), reversed_by_user_id UUID REFERENCES app_users(id),
  reversed_at TIMESTAMPTZ, reversal_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS billing_payment_allocations(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), payment_id UUID NOT NULL REFERENCES billing_payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id), amount NUMERIC(12,2) NOT NULL CHECK(amount>0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(payment_id,invoice_id)
);
CREATE TABLE IF NOT EXISTS billing_credit_notes(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), credit_note_number TEXT NOT NULL, provider_id UUID NOT NULL REFERENCES providers(id), invoice_id UUID NOT NULL REFERENCES invoices(id),
  patient_id UUID NOT NULL REFERENCES patients(id), company_id UUID REFERENCES billing_companies(id), credit_date DATE NOT NULL, amount NUMERIC(12,2) NOT NULL CHECK(amount>0),
  reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Issued' CHECK(status IN('Issued','Reversed')), issuer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, created_by_user_id UUID REFERENCES app_users(id), reversed_by_user_id UUID REFERENCES app_users(id),
  reversed_at TIMESTAMPTZ, reversal_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(provider_id,credit_note_number)
);
CREATE INDEX IF NOT EXISTS billing_payments_account_idx ON billing_payments(provider_id,customer_type,patient_id,company_id,payment_date);
CREATE INDEX IF NOT EXISTS billing_allocations_invoice_idx ON billing_payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS billing_credit_invoice_idx ON billing_credit_notes(invoice_id,credit_date);

COMMIT;
