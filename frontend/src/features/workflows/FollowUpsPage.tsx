import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Card, Empty, Field, Heading, StatusPill } from '../../components/ui';
import Modal from '../../components/Modal';
import { useResource } from '../../hooks/useResource';
import { addDays, today } from '../../lib/dates';
import { mutate } from '../../services/api';
import { Channels, deliverySummary, PatientSelect, ProviderSelect, ResourceState } from './shared';
import type { Delivery, FollowUp } from '../../types';
export default function FollowUpsPage() {
  const { user, run, notify } = useApp(),
    resource = useResource<{ followUps: FollowUp[] }>('/follow-ups'),
    initial = useLocation().state as { patientId?: string; providerId?: string } | null;
  const [open, setOpen] = useState(!!initial?.patientId),
    [patientId, setPatient] = useState(initial?.patientId || ''),
    [providerId, setProvider] = useState(
      user?.role === 'provider' ? user.entityId || '' : initial?.providerId || '',
    ),
    [date, setDate] = useState(addDays(today(), 1)),
    [time, setTime] = useState('10:00'),
    [internal, setInternal] = useState(''),
    [message, setMessage] = useState(
      'WannaTalk reminder: please contact us to arrange your recommended follow-up session.',
    ),
    [channels, setChannels] = useState(['email', 'sms']),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!channels.length) return notify('Choose Email, SMS, or both');
    setBusy(true);
    const ok = await run(async () => {
      await mutate('/follow-ups', 'POST', {
        patientId,
        providerId,
        dueAt: new Date(`${date}T${time}`).toISOString(),
        internalNote: internal,
        reminderMessage: message,
        reminderChannels: channels,
      });
      await resource.reload();
    }, 'Follow-up saved');
    if (ok) {
      setOpen(false);
      setInternal('');
    }
    setBusy(false);
  }
  async function action(id: string, action: string) {
    if (action === 'send' && !window.confirm('Send this follow-up reminder now?')) return;
    setBusy(true);
    await run(async () => {
      if (action === 'send') {
        const result = await mutate<{ deliveries: Delivery[] }>(
          `/follow-ups/${id}/send`,
          'POST',
          {},
        );
        notify(deliverySummary(result.deliveries));
      } else await mutate(`/follow-ups/${id}/status`, 'PATCH', { status: action });
      await resource.reload();
    });
    setBusy(false);
  }
  return (
    <section>
      <div className="section-title">
        <Heading
          title="Follow-ups"
          subtitle="Internal notes remain private. Only the reminder message is sent."
        />
        <button className="btn" onClick={() => setOpen(true)}>
          ＋ Create follow-up
        </button>
      </div>
      <Card>
        <ResourceState
          loading={resource.loading}
          error={resource.error}
          retry={() => void resource.reload()}
        />
        {resource.value?.followUps.length ? (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Provider</th>
                  <th>Due</th>
                  <th>Internal note</th>
                  <th>Reminder</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resource.value.followUps.map((f) => (
                  <tr key={f.id}>
                    <td>{f.patient_name}</td>
                    <td>{f.provider_name}</td>
                    <td>{new Date(f.due_at).toLocaleString('en-ZA')}</td>
                    <td>
                      <div className="workflow-private-note">
                        {f.internal_note || 'No internal note'}
                      </div>
                    </td>
                    <td>
                      {f.reminder_channels.join(' + ')}
                      <div className="sub">
                        {f.reminder_sent_at
                          ? `Sent ${new Date(f.reminder_sent_at).toLocaleString('en-ZA')}`
                          : 'Not sent'}
                      </div>
                    </td>
                    <td>
                      <StatusPill status={f.status} />
                    </td>
                    <td>
                      {f.status === 'open' && (
                        <div className="actions">
                          {[
                            ['send', 'Send reminder'],
                            ['completed', 'Complete'],
                            ['cancelled', 'Cancel'],
                          ].map(([a, label]) => (
                            <button
                              disabled={busy}
                              className="btn secondary small"
                              key={a}
                              onClick={() => void action(f.id, a)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !resource.loading && !resource.error && <Empty>No follow-ups have been created.</Empty>
        )}
      </Card>
      {open && (
        <Modal title="Create follow-up" onClose={() => setOpen(false)}>
          <div className="notice">
            The internal note is private and is never included in Email or SMS messages.
          </div>
          <form onSubmit={save}>
            <fieldset disabled={busy} className="form-reset">
              <div className="form-grid">
                <PatientSelect value={patientId} onChange={setPatient} />
                <ProviderSelect
                  value={providerId}
                  onChange={setProvider}
                  disabled={user?.role === 'provider'}
                />
                <Field label="Follow-up date">
                  <input
                    required
                    type="date"
                    min={today()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
                <Field label="Time">
                  <input
                    required
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </Field>
                <Field label="Private internal note" full>
                  <textarea
                    maxLength={2000}
                    value={internal}
                    onChange={(e) => setInternal(e.target.value)}
                  />
                </Field>
                <Field label="Patient reminder message" full>
                  <textarea
                    required
                    maxLength={1000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </Field>
                <Channels value={channels} onChange={setChannels} />
              </div>
              <button className="btn space-top">Save follow-up</button>
            </fieldset>
          </form>
        </Modal>
      )}
    </section>
  );
}
