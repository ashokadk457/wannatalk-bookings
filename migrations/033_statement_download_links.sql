CREATE TABLE IF NOT EXISTS statement_download_links (
  code VARCHAR(32) PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  customer_type VARCHAR(20) NOT NULL CHECK (customer_type IN ('patient', 'company')),
  customer_id UUID NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  created_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (to_date >= from_date)
);

CREATE INDEX IF NOT EXISTS statement_download_links_expiry_idx
  ON statement_download_links(expires_at);
