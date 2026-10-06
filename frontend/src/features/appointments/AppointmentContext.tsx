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
import { active, formatDate, joinAllowed, minutes, rescheduleAllowed, slotProblem, timeString, today } from '../../lib/dates';
import { mutate } from '../../services/api';
import { MeetingLink } from '../../components/MeetingLink';
import { Field, StatusPill } from '../../components/ui';
import { reminder } from './communications';
import type { Appointment, Status } from '../../types';

/* =================================================================
   LOCAL STYLES — sirf is component ke liye
   ================================================================= */
const LOCAL_STYLES = `
  .booking-dialog .detail-row {
    display: grid;
    grid-template-columns: 20px minmax(110px, auto) 1fr;
    align-items: center;
    gap: 10px;
  }
  .booking-dialog .detail-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--muted, #64748b);
    flex: 0 0 auto;
  }
  .booking-dialog .detail-label {
    font-size: 13px;
    opacity: 0.72;
  }
  .booking-dialog .detail-value {
    text-align: right;
    font-size: 14px;
    word-break: break-word;
    min-width: 0;
  }
  .booking-dialog .detail-row.full {
    grid-template-columns: 20px minmax(110px, auto) 1fr;
  }
  .booking-dialog .btn-with-icon,
  .app .btn-with-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
  }
  .booking-dialog .btn-with-icon svg,
  .app .btn-with-icon svg {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
  }
  @media (max-width: 480px) {
    .booking-dialog .detail-row {
      grid-template-columns: 20px 1fr;
      row-gap: 2px;
    }
    .booking-dialog .detail-value {
      grid-column: 2 / -1;
      text-align: left;
    }
  }
`;

/* =================================================================
   INLINE SVG ICONS — koi external library nahi
   ================================================================= */
const Icon = {
  Patient: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Provider: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6M9 5h6" />
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Calendar: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Type: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  ),
  Location: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Payment: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  Status: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Intake: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Online: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  Note: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
    </svg>
  ),
  Close: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Repeat: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  Message: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  FollowUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  Save: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  /* 👇 NAYA DELETE ICON */
  Delete: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
};

/* =================================================================
   REUSABLE ROW — icon + label + value aligned
   ================================================================= */
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="detail-row">
      <span className="detail-icon" aria-hidden="true">{icon}</span>
      <span className="detail-label">{label}</span>
      <strong className="detail-value">{value}</strong>
    </div>
  );
}

/* =================================================================
   ACTIONS INTERFACE + CONTEXT
   ================================================================= */
interface Actions {
  open: (a: Appointment, reschedule?: boolean) => void;
  cancel: (a: Appointment) => Promise<void>;
  remove: (a: Appointment) => Promise<void>;
  status: (a: Appointment, status: Status) => Promise<void>;
  contact: (a: Appointment) => void;
  busy: boolean;
}
const Context = createContext<Actions | null>(null);

/* =================================================================
   PROVIDER
   ================================================================= */
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
    if (reschedule && !rescheduleAllowed(a.appointment_date, a.appointment_time)) {
      notify('Rescheduling is unavailable within 10 minutes of the appointment start time');
      return;
    }
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
      {/* Local styles — sirf is component ke liye */}
      <style>{LOCAL_STYLES}</style>

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
            <button className="btn secondary btn-with-icon" onClick={close}>
              <Icon.Close />
              <span>Close</span>
            </button>
          </div>

          <div className="booking-detail-grid">
            <DetailRow icon={<Icon.Patient />}  label="Patient"          value={appointment.patient_name} />
            <DetailRow icon={<Icon.Provider />} label="Provider"         value={appointment.provider_name} />
            <DetailRow icon={<Icon.Calendar />} label="Date"             value={formatDate(appointment.appointment_date)} />
            <DetailRow
              icon={<Icon.Clock />}
              label="Time"
              value={`${appointment.appointment_time} – ${timeString(minutes(appointment.appointment_time) + appointment.duration_minutes)}`}
            />
            <DetailRow icon={<Icon.Type />}     label="Type"             value={appointment.appointment_type} />
            <DetailRow icon={<Icon.Location />} label="Location / mode"  value={appointment.location_name || appointment.mode} />
            <DetailRow icon={<Icon.Payment />}  label="Payment"          value={appointment.payment_status} />

            <div className="detail-row">
              <span className="detail-icon" aria-hidden="true"><Icon.Status /></span>
              <span className="detail-label">Status</span>
              <span className="detail-value"><StatusPill status={appointment.status} /></span>
            </div>

            <DetailRow
              icon={<Icon.Intake />}
              label="Intake"
              value={appointment.intake_requested ? 'Optional intake selected' : 'No intake selected'}
            />
            <DetailRow
              icon={<Icon.Online />}
              label="Online status"
              value={appointment.mode.toLowerCase() === 'online' ? 'Online session' : 'In-person session'}
            />

            {appointment.note && (
              <div className="detail-row full">
                <span className="detail-icon" aria-hidden="true"><Icon.Note /></span>
                <span className="detail-label">Note</span>
                <strong className="detail-value preserve-lines">{appointment.note}</strong>
              </div>
            )}
          </div>

          {joinAllowed(appointment) && (
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
                <button className="btn btn-with-icon" disabled={busy}>
                  <Icon.Save />
                  <span>Save new time</span>
                </button>
                <button
                  type="button"
                  className="btn secondary btn-with-icon"
                  onClick={() => setEditing(false)}
                >
                  <Icon.ArrowLeft />
                  <span>Back</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="modal-actions">
              <AppointmentActions appointment={appointment} />
              {user?.role !== 'patient' && (
                <>
                  <button
                    className="btn secondary btn-with-icon"
                    onClick={() => contact(appointment)}
                  >
                    <Icon.Message />
                    <span>Message patient</span>
                  </button>
                  <button
                    className="btn secondary btn-with-icon"
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
                    <Icon.FollowUp />
                    <span>Follow-up</span>
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

/* =================================================================
   HOOK
   ================================================================= */
export function useAppointments() {
  const value = useContext(Context);
  if (!value) throw new Error('AppointmentProvider missing');
  return value;
}

/* =================================================================
   ACTIONS COMPONENT
   ================================================================= */
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
          {rescheduleAllowed(a.appointment_date, a.appointment_time) && (
            <button
              disabled={actions.busy}
              className="btn secondary small btn-with-icon"
              onClick={() => actions.open(a, true)}
            >
              <Icon.Repeat />
              <span>Reschedule</span>
            </button>
          )}
          <button
            disabled={actions.busy}
            className="btn danger small btn-with-icon"
            onClick={() => void actions.cancel(a)}
          >
            <Icon.Close />
            <span>Cancel appointment</span>
          </button>
        </>
      )}
      {user?.role === 'admin' && (
        <button
          disabled={actions.busy}
          className="btn danger small btn-with-icon"
          onClick={() => void actions.remove(a)}
        >
          <Icon.Delete />
          <span>Delete</span>
        </button>
      )}
    </div>
  );
}