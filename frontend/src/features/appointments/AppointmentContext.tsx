import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useApp } from '../../app/AppContext';
import { useNavigate } from 'react-router-dom';
import { active, formatDate, minutes, slotProblem, timeString, today } from '../../lib/dates';
import { mutate } from '../../services/api';
import { MeetingLink } from '../../components/MeetingLink';
import { Field, StatusPill } from '../../components/ui';
import { reminder } from './communications';
import type { Appointment, Status } from '../../types';
interface Actions {
  open: (a: Appointment, reschedule?: boolean) => void;
  cancel: (a: Appointment) => Promise<void>;
  remove: (a: Appointment) => Promise<void>;
  status: (a: Appointment, status: Status) => Promise<void>;
  contact: (a: Appointment) => void;
  busy: boolean;
}
const Context = createContext<Actions | null>(null);
export function AppointmentProvider({ children }: { children: ReactNode }) {
  const { user, data, refresh, run, notify } = useApp(),
    navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false);
  const [date, setDate] = useState(''),
    [time, setTime] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const appointment = data.appointments.find((a) => a.id === selected);
  useEffect(() => {
    if (appointment && !dialog.current?.open) dialog.current?.showModal();
  }, [appointment]);
  function close() {
    dialog.current?.close();
    setSelected(null);
  }
  function open(a: Appointment, reschedule = false) {
    setDate(a.appointment_date);
    setTime(a.appointment_time);
    setEditing(reschedule);
    setSelected(a.id);
  }
  async function update(
    a: Appointment,
    action: string,
    body?: unknown,
    message?: string,
    method = 'PATCH',
  ) {
    setBusy(true);
    const ok = await run(async () => {
      await mutate(`/appointments/${a.id}${action}`, method, body);
      await refresh();
    }, message);
    setBusy(false);
    if (ok) close();
  }
  async function cancel(a: Appointment) {
    if (
      !active(a) ||
      !window.confirm(
        `Cancel booking on ${formatDate(a.appointment_date)} at ${a.appointment_time}?`,
      )
    )
      return;
    await update(a, '/status', { status: 'Cancelled' }, 'Appointment cancelled');
  }
  async function remove(a: Appointment) {
    if (
      user?.role !== 'admin' ||
      !window.confirm(
        `Delete booking on ${formatDate(a.appointment_date)} at ${a.appointment_time}?`,
      )
    )
      return;
    await update(a, '', undefined, 'Booking deleted and audit log updated', 'DELETE');
  }
  async function status(a: Appointment, status: Status) {
    await update(a, '/status', { status }, 'Appointment status updated');
  }
  function contact(a: Appointment) {
    if (!user || user.role === 'patient') return;
    {
      close();
      navigate(`/${user.role}/messages`, {
        state: {
          patientId: a.patient_id,
          providerId: a.provider_id,
          subject: 'WannaTalk appointment reminder',
          message: reminder(a) + (a.meeting_url ? `\n\nOnline session link: ${a.meeting_url}` : ''),
        },
      });
    }
  }
  async function reschedule(e: FormEvent) {
    e.preventDefault();
    if (!appointment) return;
    const provider = data.providers.find((p) => p.id === appointment.provider_id);
    if (!provider) return notify('Provider not found');
    const problem = slotProblem(
      { ...provider, default_duration_minutes: appointment.duration_minutes },
      date,
      time,
      data.appointments,
      appointment.id,
    );
    if (problem) return notify(problem);
    await update(
      appointment,
      '/reschedule',
      { appointmentDate: date, appointmentTime: time },
      'Appointment rescheduled',
    );
  }
  return (
    <Context.Provider value={{ open, cancel, remove, status, contact, busy }}>
      {children}
      {appointment && (
        <dialog
          ref={dialog}
          className="modal-card booking-dialog"
          aria-labelledby="booking-modal-title"
          onCancel={close}
          onClick={(e) => {
            if (e.target === dialog.current) {
              const r = dialog.current.getBoundingClientRect();
              if (
                e.clientX < r.left ||
                e.clientX > r.right ||
                e.clientY < r.top ||
                e.clientY > r.bottom
              )
                close();
            }
          }}
        >
          <div className="card-head">
            <h3 id="booking-modal-title">{editing ? 'Reschedule booking' : 'Booking details'}</h3>
            <button className="btn secondary" onClick={close}>
              Close
            </button>
          </div>
          <div className="booking-detail-grid">
            {Object.entries({
              Patient: appointment.patient_name,
              Provider: appointment.provider_name,
              Date: formatDate(appointment.appointment_date),
              Time: `${appointment.appointment_time} – ${timeString(minutes(appointment.appointment_time) + appointment.duration_minutes)}`,
              Type: appointment.appointment_type,
              'Location / mode': appointment.location_name || appointment.mode,
              Payment: appointment.payment_status,
            }).map(([label, value]) => (
              <div className="detail-row" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
            <div className="detail-row">
              <span>Status</span>
              <StatusPill status={appointment.status} />
            </div>
            <div className="detail-row">
              <span>Intake</span>
              <strong>
                {appointment.intake_requested ? 'Optional intake selected' : 'No intake selected'}
              </strong>
            </div>
            <div className="detail-row">
              <span>Online status</span>
              <strong>
                {appointment.mode.toLowerCase() === 'online'
                  ? 'Online session'
                  : 'In-person session'}
              </strong>
            </div>
            {appointment.note && (
              <div className="detail-row full">
                <span>Note</span>
                <strong className="preserve-lines">{appointment.note}</strong>
              </div>
            )}
          </div>
          {appointment.mode.toLowerCase() === 'online' && (
            <MeetingLink url={appointment.meeting_url} showUnavailable />
          )}
          {editing ? (
            <form onSubmit={reschedule}>
              <div className="form-grid space-top">
                <Field label="New appointment date">
                  <input
                    type="date"
                    required
                    min={today()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
                <Field label="New appointment time">
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </Field>
              </div>
              <div className="modal-actions">
                <button className="btn" disabled={busy}>
                  Save new time
                </button>
                <button type="button" className="btn secondary" onClick={() => setEditing(false)}>
                  Back
                </button>
              </div>
            </form>
          ) : (
            <div className="modal-actions">
              <AppointmentActions appointment={appointment} />
              {user?.role !== 'patient' && (
                <>
                  <button className="btn secondary" onClick={() => contact(appointment)}>
                    Message patient
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      close();
                      navigate(`/${user?.role}/followups`, {
                        state: {
                          patientId: appointment.patient_id,
                          providerId: appointment.provider_id,
                        },
                      });
                    }}
                  >
                    Follow-up
                  </button>
                </>
              )}
            </div>
          )}
        </dialog>
      )}
    </Context.Provider>
  );
}
export function useAppointments() {
  const value = useContext(Context);
  if (!value) throw new Error('AppointmentProvider missing');
  return value;
}
export function AppointmentActions({
  appointment: a,
  view = false,
}: {
  appointment: Appointment;
  view?: boolean;
}) {
  const actions = useAppointments(),
    { user } = useApp();
  return (
    <div className="actions">
      {view && (
        <button className="btn secondary small" onClick={() => actions.open(a)}>
          View
        </button>
      )}
      {active(a) && (
        <>
          <button
            disabled={actions.busy}
            className="btn secondary small"
            onClick={() => actions.open(a, true)}
          >
            Reschedule
          </button>
          <button
            disabled={actions.busy}
            className="btn danger small"
            onClick={() => void actions.cancel(a)}
          >
            Cancel appointment
          </button>
        </>
      )}
      {user?.role === 'admin' && (
        <button
          disabled={actions.busy}
          className="btn danger small"
          onClick={() => void actions.remove(a)}
        >
          Delete
        </button>
      )}
    </div>
  );
}
