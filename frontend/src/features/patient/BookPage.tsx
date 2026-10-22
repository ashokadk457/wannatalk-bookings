import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Card, Field, ProviderStatus } from '../../components/ui';
import { formatDate, initials, slotProblem, today } from '../../lib/dates';
import { mutate } from '../../services/api';
import SlotCalendar from '../appointments/SlotCalendar';
import type { CalendarMode } from '../appointments/Calendar';
export default function BookPage() {
  const { user, data, run, refresh, notify } = useApp(),
    navigate = useNavigate();
  const [location, setLocation] = useState(''),
    [providerId, setProviderId] = useState(''),
    [date, setDate] = useState(today()),
    [time, setTime] = useState(''),
    [calendarMode, setCalendarMode] = useState<CalendarMode>('week');
  const [type, setType] = useState('Individual counselling'),
    [mode, setMode] = useState(''),
    [note, setNote] = useState(''),
    [intake, setIntake] = useState(false),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    const refreshAvailability = () => {
      if (document.visibilityState === 'visible') void run(refresh);
    };
    window.addEventListener('focus', refreshAvailability);
    document.addEventListener('visibilitychange', refreshAvailability);
    const timer = window.setInterval(refreshAvailability, 30000);
    return () => {
      window.removeEventListener('focus', refreshAvailability);
      document.removeEventListener('visibilitychange', refreshAvailability);
      window.clearInterval(timer);
    };
  }, [refresh, run]);
  const bookingLocations = data.locations.filter((item) => item.name !== 'Online');
  const providers = data.providers.filter(
      (p) =>
        p.is_active &&
        Boolean(location) &&
        (mode === 'Online' ? p.is_online : mode === 'In-person' && p.locations.includes(location)),
    ),
    selected = providers.find((p) => p.id === providerId);
  async function confirm() {
    if (!selected || !location || !mode || !time)
      return notify('Choose location, booking format, provider, date and time');
    const availabilityLocation = mode === 'Online' ? 'Online' : location;
    const problem = slotProblem(
      selected,
      date,
      time,
      data.appointments,
      undefined,
      availabilityLocation,
    );
    if (problem) return notify(problem);
    setSaving(true);
    const ok = await run(async () => {
      await mutate('/appointments', 'POST', {
        providerId: selected.id,
        patientId: user?.entityId,
        locationId: data.locations.find((l) => l.name === location)?.id,
        appointmentDate: date,
        appointmentTime: time,
        durationMinutes: selected.default_duration_minutes,
        appointmentType: type,
        mode,
        note,
        intakeRequested: intake,
      });
      await refresh();
    }, 'Booking saved to WannaTalk');
    setSaving(false);
    if (ok) navigate('/patient/appointments');
    else {
      setTime('');
      await run(refresh);
    }
  }
  return (
    <section>
      <Card title="Choose location and booking format">
        <Field label="Practice location">
          <select
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setMode('');
              setProviderId('');
              setTime('');
            }}
          >
            <option value="">Choose location</option>
            {bookingLocations.map((l) => (
              <option key={l.id}>{l.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Booking format">
          <select
            disabled={!location}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setProviderId('');
              setTime('');
            }}
          >
            <option value="">Choose Online or Physical</option>
            <option value="In-person">Physical</option>
            <option value="Online">Online</option>
          </select>
        </Field>
      </Card>
      <div className="grid two space-top">
        <Card title="1. Choose provider">
          <div className="provider-choice">
            {!location || !mode ? (
              <div className="notice">Choose a location first, then choose Online or Physical.</div>
            ) : providers.length ? (
              providers.map((p) => (
                <button
                  key={p.id}
                  className={`provider-option ${providerId === p.id ? 'selected' : ''}`}
                  onClick={() => {
                    setProviderId(providerId === p.id ? '' : p.id);
                    setTime('');
                  }}
                >
                  <div className="actions">
                    <div className="avatar">{initials(p.full_name)}</div>
                    <div>
                      <strong>{p.full_name}</strong>
                      <div className="sub">{p.professional_title}</div>
                    </div>
                  </div>
                  <p className="sub">{p.bio || 'WannaTalk provider'}</p>
                  {mode === 'Online' ? (
                    <ProviderStatus active={p.is_active} online={p.is_online} />
                  ) : (
                    <span className="status confirmed">Available</span>
                  )}
                </button>
              ))
            ) : (
              <div className="notice">
                No providers are available for this location and booking format.
              </div>
            )}
          </div>
        </Card>
        <Card title="2. Choose date">
          <Field label="Appointment date">
            <input
              type="date"
              min={today()}
              value={date}
              onChange={(e) => {
                if (e.target.value) {
                  setDate(e.target.value);
                  setTime('');
                }
              }}
            />
          </Field>
          <div className="notice space-top">
            {date < today()
              ? 'Past dates cannot be booked.'
              : selected
                ? `${selected.full_name} selected. ${mode === 'Online' ? 'Provider is accepting online bookings.' : `Provider is available at ${location}.`}`
                : 'Select a green slot to choose a provider and time.'}
          </div>
        </Card>
      </div>
      <div className="card space-top">
        <div className="card-head">
          <h3>3. Available times</h3>
          <span className="pill">{time ? `${time} selected` : 'Choose a slot'}</span>
          <button className="btn secondary" onClick={() => void run(refresh)}>
            Refresh availability
          </button>
        </div>
        {!location || !mode ? (
          <div className="notice">
            Choose a location and booking format before selecting a slot.
          </div>
        ) : (
          <SlotCalendar
            providers={providers.filter((p) => !providerId || p.id === providerId)}
            date={date}
            mode={calendarMode}
            selectedTime={time}
            selectedProvider={providerId}
            location={mode === 'Online' ? 'Online' : location}
            onNavigate={(d, m) => {
              setDate(d);
              setCalendarMode(m);
              setTime('');
            }}
            onSelect={(d, p, t) => {
              setDate(d);
              setProviderId(p);
              setTime(t);
            }}
          />
        )}
      </div>
      <div className="grid two space-top">
        <Card title="4. Appointment details">
          <div className="form-grid">
            <Field label="Appointment type">
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {[
                  'Individual counselling',
                  'Couples counselling',
                  'Family counselling',
                  'Assessment',
                  'Follow-up',
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Note for provider" full>
              <textarea
                placeholder="Optional"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <div className="intake-option">
              <label>
                <input
                  type="checkbox"
                  checked={intake}
                  onChange={(e) => setIntake(e.target.checked)}
                />
                <span>
                  <strong>Optional private intake</strong>
                  <br />
                  <span className="sub">
                    Choose this if you would feel more comfortable sharing some information before
                    your session.
                  </span>
                </span>
              </label>
              <p>The intake form is optional and opens on the WannaTalk intake website.</p>
              <a
                className="intake-link"
                href="https://intake.wannatalk.co.za/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open WannaTalk intake form →
              </a>
            </div>
          </div>
        </Card>
        <Card title="Booking summary" className="whatsapp">
          <div className="phone-bubble">
            {selected && time ? (
              <>
                <strong>{selected.full_name}</strong>
                <p>
                  {type}
                  <br />
                  {formatDate(date)} at {time}
                  <br />
                  {selected.default_duration_minutes} minutes · {location}
                  <br />
                  {mode === 'Online' ? 'Online' : 'Physical'}
                </p>
                {intake && <span className="intake-badge">Optional intake selected</span>}
                <a
                  className="intake-link"
                  href={`/patient/cancellation-policy/${selected.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View cancellation policy ↗
                </a>
              </>
            ) : (
              'Choose a location, booking format, provider, date and time to preview your booking.'
            )}
          </div>
          <button
            disabled={saving}
            className="btn full-width space-top"
            onClick={() => void confirm()}
          >
            {saving ? 'Saving…' : 'Confirm Booking'}
          </button>
        </Card>
      </div>
    </section>
  );
}
