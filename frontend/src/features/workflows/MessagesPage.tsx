import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Card, Empty, Field, Heading, StatusPill } from '../../components/ui';
import Modal from '../../components/Modal';
import { useResource } from '../../hooks/useResource';
import { mutate } from '../../services/api';
import { Channels, deliverySummary, PatientSelect, ProviderSelect, ResourceState } from './shared';
import type { Delivery } from '../../types';
import type { Appointment } from '../../types';
export default function MessagesPage({ appointmentMode = false, appointmentOptions = [], defaultPatientIds = [], defaultSubject, defaultMessage }: { appointmentMode?: boolean; appointmentOptions?: Appointment[]; defaultPatientIds?: string[]; defaultSubject?: string; defaultMessage?: string }) {
  const { user, run, notify } = useApp(),
    resource = useResource<{ deliveries: Delivery[] }>('/communications');
  const initial = useLocation().state as {
    patientId?: string;
    patientIds?: string[];
    providerId?: string;
    subject?: string;
    message?: string;
  } | null;
  const [patientId, setPatient] = useState(initial?.patientId || ''),
    [patientIds, setPatientIds] = useState(initial?.patientIds || defaultPatientIds),
    [providerId, setProvider] = useState(
      user?.role === 'provider' ? user.entityId || '' : initial?.providerId || '',
    ),
    [subject, setSubject] = useState(initial?.subject || defaultSubject || 'Message from WannaTalk'),
    [message, setMessage] = useState(initial?.message || defaultMessage || ''),
    [channels, setChannels] = useState(['email', 'sms', 'whatsapp']),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Delivery | null>(null),
    [logSearch, setLogSearch] = useState(''),
    [logPage, setLogPage] = useState(1);
  const pageSize = 20;
  const filteredDeliveries = (resource.value?.deliveries || []).filter((d) => `${d.patient_name} ${d.provider_name || ''} ${d.channel} ${d.status} ${d.subject}`.toLowerCase().includes(logSearch.toLowerCase()));
  const pagedDeliveries = filteredDeliveries.slice((logPage - 1) * pageSize, logPage * pageSize);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!channels.length) return notify('Choose Email, SMS, or both');
    if (!window.confirm('Send this message by the selected channels now?')) return;
    setBusy(true);
    await run(async () => {
      const result = await mutate<{ deliveries: Delivery[] }>(patientIds.length ? '/communications/bulk-send' : '/communications/send', 'POST', {
        ...(patientIds.length ? { patientIds } : { patientId }),
        providerId: providerId || null,
        subject,
        message,
        channels,
      });
      notify(deliverySummary(result.deliveries));
      await resource.reload();
    });
    setBusy(false);
  }
  return (
    <section>
      <Heading
        title={appointmentMode ? 'Appointment reminders' : 'Messages'}
        subtitle={appointmentMode ? 'Send a reminder to patients with tomorrow’s bookings.' : 'Send patient communications by Email, SMS, or WhatsApp and review delivery history.'}
      />
      <div className="grid two">
          <Card title={patientIds.length ? `Send message to ${patientIds.length} patients` : appointmentMode ? 'Send appointment reminder' : 'Send patient message'}>
          <form onSubmit={send}>
            <fieldset className="form-reset" disabled={busy}>
              <div className="form-grid">
                {appointmentMode ? <fieldset className="field full location-fields"><legend>Select appointment patients</legend><div className="notice">Only upcoming active appointments are shown. Uncheck anyone who should not receive this reminder.</div><div className="workflow-checks">{appointmentOptions.length ? appointmentOptions.map((a) => <label key={a.id} className="appointment-recipient"><input type="checkbox" checked={patientIds.includes(a.patient_id)} onChange={(e) => setPatientIds((current) => e.target.checked ? [...new Set([...current, a.patient_id])] : current.filter((id) => id !== a.patient_id))} /><span><strong>{a.patient_name}</strong><small>{a.appointment_date} · {a.appointment_time} · {a.mode}</small></span></label>) : <span>No upcoming appointments found.</span>}</div></fieldset> : patientIds.length ? <div className="notice">Patients selected from the appointment list: {patientIds.length}</div> : <PatientSelect value={patientId} onChange={setPatient} />}
                {user?.role === 'admin' && (
                  <ProviderSelect value={providerId} onChange={setProvider} optional />
                )}
                <Field label="Subject" full>
                  <input
                    required
                    maxLength={160}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </Field>
                <Field label="Message" full>
                  <textarea
                    required
                    maxLength={1000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </Field>
                <Channels value={channels} onChange={setChannels} />
              </div>
              <button className="btn space-top">{busy ? 'Sending…' : 'Send message'}</button>
            </fieldset>
          </form>
        </Card>
        <Card title="Delivery information">
          <div className="notice">
            Only the message entered here is sent. Private follow-up notes are never included.
          </div>
          <p>Delivery status depends on the configured Email and SMS services.</p>
        </Card>
      </div>
      <Card title="Delivery history" className="space-top">
        <div className="admin-filters"><Field label="Search send logs"><input value={logSearch} placeholder="Patient, channel, status" onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }} /></Field></div>
        <ResourceState
          loading={resource.loading}
          error={resource.error}
          retry={() => void resource.reload()}
        />
        {pagedDeliveries.length ? (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Provider</th>
                  <th>Channel</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pagedDeliveries.map((d) => (
                  <tr key={d.id}>
                    <td>{new Date(d.created_at).toLocaleString('en-ZA')}</td>
                    <td>{d.patient_name}</td>
                    <td>{d.provider_name || 'Practice'}</td>
                    <td>{d.channel}</td>
                    <td>{d.subject}</td>
                    <td>
                      <StatusPill status={d.status} />
                    </td>
                    <td>
                      <button className="btn secondary small" onClick={() => setSelected(d)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !resource.loading && !resource.error && <Empty>No messages sent yet.</Empty>
        )}
        {filteredDeliveries.length > pageSize && <div className="modal-actions space-top"><button className="btn secondary small" disabled={logPage === 1} onClick={() => setLogPage((p) => p - 1)}>Previous</button><span>Page {logPage} of {Math.ceil(filteredDeliveries.length / pageSize)}</span><button className="btn secondary small" disabled={logPage >= Math.ceil(filteredDeliveries.length / pageSize)} onClick={() => setLogPage((p) => p + 1)}>Next</button></div>}
      </Card>
      {selected && (
        <Modal title="Message details" onClose={() => setSelected(null)}>
          <p>
            <strong>{selected.patient_name}</strong> · {selected.recipient}
          </p>
          <p>{selected.subject}</p>
          <div className="workflow-message">{selected.message_text}</div>
          <p>
            <StatusPill status={selected.status} />
          </p>
          {selected.error_message && (
            <div className="notice" role="alert">
              {selected.error_message}
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
