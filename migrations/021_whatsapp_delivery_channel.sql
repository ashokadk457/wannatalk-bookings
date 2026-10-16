BEGIN;

ALTER TABLE communication_deliveries
  DROP CONSTRAINT IF EXISTS communication_deliveries_channel_check;

ALTER TABLE communication_deliveries
  ADD CONSTRAINT communication_deliveries_channel_check
  CHECK (channel IN ('email', 'sms', 'whatsapp'));

COMMIT;
