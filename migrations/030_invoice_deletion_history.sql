BEGIN;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_before_delete TEXT;

CREATE INDEX IF NOT EXISTS invoices_deleted_at_idx
  ON invoices(deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

COMMIT;
