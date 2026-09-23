import { useApp } from '../../app/AppContext';
import { MeetingLink } from '../../components/MeetingLink';
import { Empty, StatusPill } from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { AppointmentActions, useAppointments } from './AppointmentContext';
import { statuses, type Appointment, type Status } from '../../types';
export default function AppointmentTable({
  appointments,
  editable = false,
}: {
  appointments: Appointment[];
  editable?: boolean;
}) {
  const { user } = useApp(),
    actions = useAppointments();
  if (!appointments.length) return <Empty>No appointments match this view.</Empty>;
  return (
    <div className="dashboard-table">
      <table>
        <thead>
          <tr>
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
                <MeetingLink url={a.meeting_url} />
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
    </div>
  );
}
