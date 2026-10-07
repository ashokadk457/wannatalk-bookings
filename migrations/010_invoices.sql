BEGIN;

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1;

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  created_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  status TEXT NOT NULL DEFAULT 'Issued' CHECK (status IN ('Issued', 'Paid', 'Void')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, appointment_id)
);

CREATE INDEX IF NOT EXISTS invoices_patient_issued_idx ON invoices(patient_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS invoice_items_appointment_idx ON invoice_items(appointment_id);

COMMIT;
