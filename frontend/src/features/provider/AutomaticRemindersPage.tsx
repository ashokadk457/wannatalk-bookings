import { useEffect, useState } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Field, Heading, StatusPill } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { mutate } from '../../services/api';
import { ResourceState } from '../workflows/shared';

type Template = { subject: string; message: string };
type Settings = {
  enabled: boolean;
  offsets: number[];
  language: string;
  templates: Record<string, Record<string, Template>>;
};
type Delivery = {
  id: string;
  recipient_kind: string;
  recipient: string;
  offset_minutes: number;
  status: string;
  error_message: string | null;
  created_at: string;
};
const fields = [
  'recipient_name',
  'patient_name',
  'provider_name',
  'appointment_date',
  'start_time',
  'end_time',
  'mode',
];
export default function AutomaticRemindersPage() {
  const resource = useResource<{ settings: Settings; deliveries: Delivery[]; timezone: string }>(
    '/automatic-reminders',
  );
  const { notify } = useApp();
  const [settings, setSettings] = useState<Settings | null>(null),
    [tab, setTab] = useState('en'),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (resource.value && !settings) {
      setSettings(resource.value.settings);
      setTab(resource.value.settings.language);
    }
  }, [resource.value, settings]);
  function changeTemplate(kind: string, field: string, value: string) {
    setSettings((current) =>
      current
        ? {
            ...current,
            templates: {
              ...current.templates,
              [tab]: {
                ...current.templates[tab],
                [kind]: { ...current.templates[tab][kind], [field]: value },
              },
            },
          }
        : current,
    );
  }
  async function save() {
    if (!settings) return;
    if (settings.enabled && !settings.offsets.length)
      return notify('Choose at least one reminder time');
    setBusy(true);
    try {
      await mutate('/automatic-reminders', 'PUT', settings);
      notify('Automatic reminder settings saved');
      await resource.reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to save settings');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reminder-settings-page">
      <Heading
        title="Reminder Setting"
        subtitle="Email appointment reminders to you and your patients at the times you choose."
      />
      <ResourceState
        loading={resource.loading}
        error={resource.error}
        retry={() => void resource.reload()}
      />
      {settings && (
        <Card title="Reminder settings">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset
              className="form-reset"
              disabled={busy || resource.loading || !!resource.error}
            >
              <label className="reminder-enable">
                <span className="reminder-enable-copy"><strong>Automatic email reminders</strong><span>Send reminders to you and your patient before each appointment.</span></span>
                <span className="reminder-switch">
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Enable automatic email reminders"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                />
                <span className="reminder-switch-track" aria-hidden="true" />
                </span>
              </label>
              <div className="reminder-preferences">
              <fieldset className="reminder-timing">
                <legend>When should we send reminders?</legend>
                <p className="sub">Choose one or more times before the appointment.</p>
                <div className="reminder-time-options">
                  {[
                    [1440, '24 hours'],
                    [30, '30 minutes'],
                    [15, '15 minutes'],
                  ].map(([minutes, label]) => (
                    <label key={minutes} className={`reminder-time-option${settings.offsets.includes(Number(minutes)) ? ' selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={settings.offsets.includes(Number(minutes))}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            offsets: e.target.checked
                              ? [...settings.offsets, Number(minutes)]
                              : settings.offsets.filter((n) => n !== minutes),
                          })
                        }
                      />{' '}
                      <span><strong>{label}</strong><small>before appointment</small></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="reminder-language"><Field label="Sending language">
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                >
                  <option value="en">English</option>
                  <option value="af">Afrikaans</option>
                </select>
              </Field>
              <p className="sub">Both you and your patient receive emails in this language.</p></div>
              </div>
              <p className="sub">
                Appointment timezone: {resource.value?.timezone}. Reminders start after settings are
                enabled and saved. You can close this page after saving.
              </p>
              <div className="reminder-template-heading"><h3>Email templates</h3><span className="reminder-email-badge">Email only</span></div>
              <div className="tabs" role="group" aria-label="Email template language">
                {['en', 'af'].map((lang) => (
                  <button
                    type="button"
                    key={lang}
                    className={`tab${tab === lang ? ' active' : ''}`}
                    aria-pressed={tab === lang}
                    onClick={() => setTab(lang)}
                  >
                    {lang === 'en' ? 'English email' : 'Afrikaans email'}
                  </button>
                ))}
              </div>
              <p className="sub">
                Editing a language tab does not change the language used for sending. Choose that
                above.
              </p>
              <div className="grid two">
                {['patient', 'provider'].map((kind) => (
                  <fieldset className="location-fields reminder-email-editor" key={kind}>
                    <legend>{kind === 'patient' ? 'Patient email' : 'Your email'}</legend>
                    <Field label="Subject" full>
                      <input
                        required
                        maxLength={160}
                        value={settings.templates[tab][kind].subject}
                        onChange={(e) => changeTemplate(kind, 'subject', e.target.value)}
                      />
                    </Field>
                    <Field label="Body" full>
                      <textarea
                        required
                        maxLength={1000}
                        value={settings.templates[tab][kind].message}
                        onChange={(e) => changeTemplate(kind, 'message', e.target.value)}
                      />
                    </Field>
                    <div className="placeholder-toolbar">
                      <span>Insert field:</span>
                      {fields.map((field) => (
                        <button
                          type="button"
                          className="btn secondary small"
                          key={field}
                          onClick={() =>
                            changeTemplate(
                              kind,
                              'message',
                              settings.templates[tab][kind].message + ' {{' + field + '}}',
                            )
                          }
                        >
                          {'{{' + field + '}}'}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <div className="reminder-save"><span className="sub">Changes take effect when you save.</span><button className="btn">
                {busy ? 'Saving…' : 'Save reminder settings'}
              </button>
              </div>
            </fieldset>
          </form>
        </Card>
      )}
      <Card title="Automatic email history" className="space-top">
        <button
          type="button"
          className="btn secondary small"
          onClick={() => void resource.reload()}
        >
          Refresh history
        </button>
        {resource.value?.deliveries.length ? (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Recipient</th>
                  <th>Reminder</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {resource.value.deliveries.map((d) => (
                  <tr key={d.id}>
                    <td>{new Date(d.created_at).toLocaleString('en-ZA')}</td>
                    <td>
                      {d.recipient_kind}: {d.recipient}
                    </td>
                    <td>
                      {d.offset_minutes === 1440 ? '24 hours' : `${d.offset_minutes} minutes`}
                    </td>
                    <td>
                      <StatusPill status={d.status} />
                    </td>
                    <td>{d.error_message || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No automatic reminders sent yet.</p>
        )}
      </Card>
    </section>
  );
}
