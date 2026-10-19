BEGIN;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_review_reason TEXT;

UPDATE invoices
SET due_at = COALESCE(due_at, (due_date::timestamp + time '23:59:59') AT TIME ZONE 'Africa/Johannesburg')
WHERE due_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  company_id UUID REFERENCES billing_companies(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  payment_id UUID REFERENCES billing_payments(id),
  refund_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  reference TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Paid' CHECK (status IN ('Paid','Reversed')),
  created_by_user_id UUID REFERENCES app_users(id),
  reversed_by_user_id UUID REFERENCES app_users(id),
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_refunds_invoice_idx ON billing_refunds(invoice_id, refund_date DESC);
CREATE INDEX IF NOT EXISTS invoices_due_at_idx ON invoices(due_at) WHERE outstanding_balance > 0;
CREATE INDEX IF NOT EXISTS invoices_billing_review_idx ON invoices(billing_review) WHERE billing_review = true;

COMMIT;
