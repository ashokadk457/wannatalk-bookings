BEGIN;

ALTER TABLE follow_ups
  DROP CONSTRAINT IF EXISTS follow_ups_reminder_channels_check;
ALTER TABLE follow_ups
  ADD CONSTRAINT follow_ups_reminder_channels_check
  CHECK (reminder_channels <@ ARRAY['email', 'sms', 'whatsapp']::TEXT[]);

ALTER TABLE waiting_list_entries
  DROP CONSTRAINT IF EXISTS waiting_list_entries_notification_channels_check;
ALTER TABLE waiting_list_entries
  ADD CONSTRAINT waiting_list_entries_notification_channels_check
  CHECK (notification_channels <@ ARRAY['email', 'sms', 'whatsapp']::TEXT[]);

COMMIT;
