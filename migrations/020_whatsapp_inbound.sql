BEGIN;

CREATE TABLE IF NOT EXISTS whatsapp_inbound_webhooks (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_webhooks_received_idx
  ON whatsapp_inbound_webhooks(received_at DESC);

GRANT SELECT, INSERT ON TABLE whatsapp_inbound_webhooks TO anton;
GRANT USAGE, SELECT ON SEQUENCE whatsapp_inbound_webhooks_id_seq TO anton;

COMMIT;
