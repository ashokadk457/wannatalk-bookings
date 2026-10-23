CREATE TABLE IF NOT EXISTS invoice_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  edited_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  edited_by_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  invoice_snapshot JSONB NOT NULL,
  changes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, version_number)
);

CREATE INDEX IF NOT EXISTS invoice_edit_history_invoice_idx
  ON invoice_edit_history(invoice_id, version_number DESC);
