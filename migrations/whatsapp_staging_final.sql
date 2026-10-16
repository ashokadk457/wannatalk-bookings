-- WannaTalk WhatsApp staging migration
-- Run against the staging database as its schema owner or a database administrator.
-- If the staging API connects with a different PostgreSQL role, add that role to
-- the role list in the grant block below before running this script.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.communication_deliveries') IS NULL THEN
    RAISE EXCEPTION 'Required table public.communication_deliveries does not exist; apply the application migrations through 019 first.';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_webhooks (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_webhooks_received_idx
  ON public.whatsapp_inbound_webhooks (received_at DESC);

ALTER TABLE public.communication_deliveries
  DROP CONSTRAINT IF EXISTS communication_deliveries_channel_check;

ALTER TABLE public.communication_deliveries
  ADD CONSTRAINT communication_deliveries_channel_check
  CHECK (channel IN ('email', 'sms', 'whatsapp'));

ALTER TABLE public.follow_ups
  DROP CONSTRAINT IF EXISTS follow_ups_reminder_channels_check;
ALTER TABLE public.follow_ups
  ADD CONSTRAINT follow_ups_reminder_channels_check
  CHECK (reminder_channels <@ ARRAY['email', 'sms', 'whatsapp']::TEXT[]);

ALTER TABLE public.waiting_list_entries
  DROP CONSTRAINT IF EXISTS waiting_list_entries_notification_channels_check;
ALTER TABLE public.waiting_list_entries
  ADD CONSTRAINT waiting_list_entries_notification_channels_check
  CHECK (notification_channels <@ ARRAY['email', 'sms', 'whatsapp']::TEXT[]);

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS reminder_attempted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS follow_ups_appointment_sent_idx
  ON public.follow_ups(appointment_id, reminder_sent_at)
  WHERE appointment_id IS NOT NULL;

DO $$
DECLARE
  app_role TEXT;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anton', 'wannatalkanton'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT, INSERT ON TABLE public.whatsapp_inbound_webhooks TO %I', app_role);
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.whatsapp_inbound_webhooks_id_seq TO %I', app_role);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.communication_deliveries TO %I', app_role);
    END IF;
  END LOOP;
END
$$;

COMMIT;
