CREATE TABLE IF NOT EXISTS billing_default_bank_account (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton = TRUE),
  account_holder TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL,
  branch_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL
);

INSERT INTO billing_default_bank_account
  (singleton, account_holder, bank_name, account_number, account_type, branch_code)
VALUES
  (TRUE, 'Louw Alberts', 'FNB', '63191320620', 'CHEQUE ACCOUNT', NULL)
ON CONFLICT (singleton) DO NOTHING;
