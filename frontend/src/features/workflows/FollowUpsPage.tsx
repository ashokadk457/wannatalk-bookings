import { useState, type FormEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Card, Empty, Field, Heading, StatusPill } from '../../components/ui';
import Modal from '../../components/Modal';
import { useResource } from '../../hooks/useResource';
import { addDays, today } from '../../lib/dates';
import { mutate } from '../../services/api';
import { Channels, deliverySummary, PatientSelect, ProviderSelect, ResourceState } from './shared';
import type { Delivery, FollowUp } from '../../types';
import ApplicationFollowUpRules from './ApplicationFollowUpRules';
export default function FollowUpsPage() {
  const { user, run, notify, refresh, setAppointmentFollowUpAttempted } = useApp(),
    resource = useResource<{ followUps: FollowUp[] }>('/follow-ups'),
    initial = useLocation().state as { patientId?: string; providerId?: string; appointmentId?: string } | null,
    [searchParams] = useSearchParams(),
    appointmentId = initial?.appointmentId || searchParams.get('appointmentId') || undefined;
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
    [deliveryMode, setDeliveryMode] = useState<'scheduled' | 'manual' | 'immediate'>('scheduled'),
    [tab,setTab]=useState<'individual'|'application'>('individual'),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!channels.length) return notify('Choose Email, SMS, or both');
    setBusy(true);
    let created: FollowUp | null = null;
    const ok = await run(async () => {
      const result = await mutate<{ followUp: FollowUp }>('/follow-ups', 'POST', {
        patientId,
        providerId,
        appointmentId,
        dueAt: new Date(`${date}T${time}`).toISOString(),
        internalNote: internal,
        reminderMessage: message,
        reminderChannels: channels,
        scheduleReminder: deliveryMode === 'scheduled',
      });
      created = result.followUp;
      await resource.reload();
    });
    if (ok) {
      setOpen(false);
      setInternal('');
      const followUp = created as FollowUp | null;
      if (deliveryMode === 'immediate' && followUp) {
        const linkedAppointmentId = followUp.appointment_id || appointmentId;
        if (linkedAppointmentId) setAppointmentFollowUpAttempted(linkedAppointmentId, true);
        let deliveries: Delivery[] = [];
        const sent = await run(async () => {
          const result = await mutate<{ deliveries: Delivery[] }>(
            `/follow-ups/${followUp.id}/send`,
            'POST',
            { appointmentId: linkedAppointmentId },
          );
          deliveries = result.deliveries;
        });
        if (sent) {
          notify(deliverySummary(deliveries));
          await resource.reload();
          try {
            await refresh();
          } catch {
            // Keep the delivery result visible; the appointment list can refresh on next load.
          }
        }
      } else {
        notify('Follow-up saved');
      }
    }
    setBusy(false);
  }
  async function action(id: string, action: string, followUpAppointmentId?: string | null) {
    if (action === 'send' && !window.confirm('Send this follow-up reminder now?')) return;
    if (
      action === 'delete' &&
      !window.confirm('Permanently delete this follow-up? This cannot be undone.')
    )
      return;
    setBusy(true);
    if (action === 'send') {
      const linkedAppointmentId = followUpAppointmentId || appointmentId;
      if (linkedAppointmentId) {
        setAppointmentFollowUpAttempted(linkedAppointmentId, true);
      }
      let deliveries: Delivery[] = [];
      const sent = await run(async () => {
        const result = await mutate<{ deliveries: Delivery[] }>(
          `/follow-ups/${id}/send`,
          'POST',
          { appointmentId: linkedAppointmentId },
        );
        deliveries = result.deliveries;
      });
      if (sent) {
        notify(deliverySummary(deliveries));
        await resource.reload();
        try {
          await refresh();
        } catch {
          // Keep the delivery result visible; the appointment list can refresh on next load.
        }
      }
    } else {
      await run(async () => {
        if (action === 'delete') {
          await mutate(`/follow-ups/${id}`, 'DELETE');
          notify('Follow-up deleted');
        } else await mutate(`/follow-ups/${id}/status`, 'PATCH', { status: action });
        await resource.reload();
      });
    }
    setBusy(false);
  }
  return (
    <section>
      <div className="section-title">
        <Heading
          title="Follow-ups"
          subtitle="Internal notes remain private. Only the reminder message is sent."
        />
        {tab==='individual'&&<button className="btn" onClick={() => setOpen(true)}>
          ＋ Create follow-up
        </button>}
      </div>
      {user?.role==='admin'&&<nav className="workflow-tabs" aria-label="Follow-up configuration"><button className={tab==='individual'?'active':''} onClick={()=>setTab('individual')}>Patient follow-ups</button><button className={tab==='application'?'active':''} onClick={()=>setTab('application')}>Application follow-up rules</button></nav>}
      {tab==='application'&&user?.role==='admin'?<ApplicationFollowUpRules/>:<Card>
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
                        {f.reminder_schedule_enabled
                          ? `Scheduled for ${new Date(f.due_at).toLocaleString('en-ZA')}`
                          : f.reminder_sent_at
                            ? `Sent ${new Date(f.reminder_sent_at).toLocaleString('en-ZA')}`
                            : 'Not sent'}
                      </div>
                    </td>
                    <td>
                      <StatusPill status={f.status} />
                    </td>
                    <td>
                      <div className="actions">
                        {f.status === 'open' && (
                          <div className="actions">
                            {[
                              ['send', f.reminder_schedule_enabled ? 'Send now' : 'Send reminder'],
                              ['completed', 'Complete'],
                              ['cancelled', 'Cancel'],
                            ].map(([a, label]) => (
                              <button
                                disabled={busy}
                                className="btn secondary small"
                                key={a}
                                onClick={() => void action(f.id, a, f.appointment_id)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                        {user?.role !== 'patient' && (
                          <button
                            type="button"
                            disabled={busy}
                            className="btn danger small followup-delete-action"
                            aria-label={`Delete follow-up for ${f.patient_name}`}
                            title={`Delete follow-up for ${f.patient_name}`}
                            onClick={() => void action(f.id, 'delete')}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                              <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !resource.loading && !resource.error && <Empty>No follow-ups have been created.</Empty>
        )}
      </Card>}
      {tab==='individual'&&open && (
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
                <Field label="Reminder delivery" full>
                  <div className="workflow-checks">
                    <label className="check-row">
                      <input
                        type="radio"
                        name="follow-up-delivery-mode"
                        checked={deliveryMode === 'scheduled'}
                        onChange={() => setDeliveryMode('scheduled')}
                      />{' '}
                      Schedule automatically for the selected date and time
                    </label>
                    <label className="check-row">
                      <input
                        type="radio"
                        name="follow-up-delivery-mode"
                        checked={deliveryMode === 'manual'}
                        onChange={() => setDeliveryMode('manual')}
                      />{' '}
                      Quick send manually using “Send reminder”
                    </label>
                    <label className="check-row">
                      <input
                        type="radio"
                        name="follow-up-delivery-mode"
                        checked={deliveryMode === 'immediate'}
                        onChange={() => setDeliveryMode('immediate')}
                      />{' '}
                      Send immediately after saving this follow-up
                    </label>
                  </div>
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
