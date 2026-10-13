BEGIN;
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES providers(id), ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES billing_companies(id),
  ADD COLUMN IF NOT EXISTS billing_customer_type TEXT NOT NULL DEFAULT 'patient', ADD COLUMN IF NOT EXISTS issuer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS due_date DATE, ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12,2) NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS tax_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payments_received NUMERIC(12,2) NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;
UPDATE invoices i SET provider_id=s.provider_id FROM (SELECT ii.invoice_id,MIN(a.provider_id::text)::uuid provider_id FROM invoice_items ii JOIN appointments a ON a.id=ii.appointment_id GROUP BY ii.invoice_id)s WHERE s.invoice_id=i.id AND i.provider_id IS NULL;
UPDATE invoices SET issue_date=issued_at::date,subtotal=total_amount,outstanding_balance=total_amount WHERE subtotal=0;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK(status IN('Draft','Issued','Part Paid','Paid','Overdue','Credited','Void'));
ALTER TABLE invoices ADD CONSTRAINT invoices_customer_type_check CHECK(billing_customer_type IN('patient','company'));
CREATE UNIQUE INDEX IF NOT EXISTS invoices_provider_number_uidx ON invoices(provider_id,invoice_number);
CREATE INDEX IF NOT EXISTS invoices_provider_issue_idx ON invoices(provider_id,issue_date DESC);
ALTER TABLE invoice_items ALTER COLUMN appointment_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS service_date DATE, ADD COLUMN IF NOT EXISTS tariff_code TEXT, ADD COLUMN IF NOT EXISTS icd10_code TEXT,
  ADD COLUMN IF NOT EXISTS document_number TEXT, ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rate NUMERIC(12,2) NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
UPDATE invoice_items ii SET service_date=a.appointment_date,rate=ii.amount FROM appointments a WHERE a.id=ii.appointment_id AND ii.rate=0;
COMMIT;
