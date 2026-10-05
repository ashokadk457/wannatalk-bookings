import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { MeetingLink } from '../../components/MeetingLink';
import { Empty, StatusPill } from '../../components/ui';
import { formatDate, joinAllowed } from '../../lib/dates';
import { AppointmentActions, useAppointments } from './AppointmentContext';
import { statuses, type Appointment, type Status } from '../../types';
export default function AppointmentTable({
  appointments,
  editable = false,
  bulkMessaging = false,
}: {
  appointments: Appointment[];
  editable?: boolean;
  bulkMessaging?: boolean;
}) {
  const { user } = useApp(),
    actions = useAppointments(),
    navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const patientIds = [...new Set(appointments.map((a) => a.patient_id))];
  const selectedPatients = selected.filter((id) => patientIds.includes(id));
  const selectAll = () => setSelected(selectedPatients.length === patientIds.length ? [] : patientIds);
  if (!appointments.length) return <Empty>No appointments match this view.</Empty>;
  return (
    <div className="dashboard-table">
      <table>
        <thead>
          <tr>
            {bulkMessaging && user?.role !== 'patient' && <th><input type="checkbox" aria-label="Select all patients" checked={patientIds.length > 0 && selectedPatients.length === patientIds.length} onChange={selectAll} /></th>}
            <th>Date</th>
            <th>Time</th>
            {user?.role !== 'patient' && <th>Patient</th>}
            {user?.role !== 'provider' && <th>Provider</th>}
            <th>Type / location</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id} onDoubleClick={() => actions.open(a)}>
                {bulkMessaging && user?.role !== 'patient' && <td><input type="checkbox" aria-label={`Select ${a.patient_name}`} checked={selected.includes(a.patient_id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, a.patient_id] : current.filter((id) => id !== a.patient_id))} /></td>}
                <td>{formatDate(a.appointment_date)}</td>
              <td>
                <strong>{a.appointment_time}</strong>
                <div className="sub">{a.duration_minutes} min</div>
              </td>
              {user?.role !== 'patient' && (
                <td>
                  <span className="patient-name">{a.patient_name}</span>
                  <div className="sub">{a.patient_mobile || a.patient_email}</div>
                </td>
              )}
              {user?.role !== 'provider' && (
                <td>
                  <span className="patient-name">{a.provider_name}</span>
                  <div className="sub">{a.professional_title}</div>
                </td>
              )}
              <td>
                {a.appointment_type}
                <div className="sub">📍 {a.location_name || a.mode}</div>
                {joinAllowed(a) && <MeetingLink url={a.meeting_url} />}
                {a.intake_requested && <div className="intake-badge">Intake selected</div>}
              </td>
              <td>
                {editable && user?.role !== 'patient' ? (
                  <select
                    aria-label={`Status for ${a.patient_name} on ${a.appointment_date}`}
                    disabled={actions.busy}
                    value={a.status}
                    onChange={(e) => void actions.status(a, e.target.value as Status)}
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <StatusPill status={a.status} />
                )}
              </td>
              <td>
                <AppointmentActions appointment={a} view />
                {user?.role !== 'patient' && (
                  <button
                    className="btn secondary small space-top"
                    onClick={() => actions.contact(a)}
                  >
                    Message
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {bulkMessaging && user?.role !== 'patient' && selectedPatients.length > 0 && (
        <div className="modal-actions space-top"><span>{selectedPatients.length} patient(s) selected</span><button className="btn" onClick={() => navigate(`/${user?.role}/appointment-messages`, { state: { patientIds: selectedPatients } })}>Message selected patients</button></div>
      )}
    </div>
  );
}
