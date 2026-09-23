import { useState } from 'react';
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
    [mode, setMode] = useState('In-person'),
    [note, setNote] = useState(''),
    [intake, setIntake] = useState(false),
    [saving, setSaving] = useState(false);
  const providers = data.providers.filter((p) => p.is_active && p.locations.includes(location)),
    selected = providers.find((p) => p.id === providerId);
  async function confirm() {
    if (!selected || !location || !time) return notify('Choose location, provider, date and time');
    const problem = slotProblem(selected, date, time, data.appointments);
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
        mode: location === 'Online' ? 'Online' : mode,
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
      <Card title="Choose a location">
        <Field label="Practice location">
          <select
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setProviderId('');
              setTime('');
            }}
          >
            <option value="">Choose location</option>
            {data.locations.map((l) => (
              <option key={l.id}>{l.name}</option>
            ))}
          </select>
        </Field>
      </Card>
      <div className="grid two space-top">
        <Card title="1. Choose provider">
          <div className="provider-choice">
            {!location ? (
              <div className="notice">Choose a location first to see available providers.</div>
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
                  <ProviderStatus active={p.is_active} online={p.is_online} />
                </button>
              ))
            ) : (
              <div className="notice">No providers currently offer {location}.</div>
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
                ? `${selected.full_name} selected. ${selected.is_online ? 'Provider is online.' : 'Provider is offline, but booking slots remain available.'}`
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
        {!location ? (
          <div className="notice">
            Choose Centurion, Emalahleni or Online before selecting a time slot.
          </div>
        ) : (
          <SlotCalendar
            providers={providers.filter((p) => !providerId || p.id === providerId)}
            date={date}
            mode={calendarMode}
            selectedTime={time}
            selectedProvider={providerId}
            location={location}
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
            <Field label="Mode">
              <select
                value={location === 'Online' ? 'Online' : mode}
                disabled={location === 'Online'}
                onChange={(e) => setMode(e.target.value)}
              >
                {['In-person', 'Online', 'Telephone'].map((m) => (
                  <option key={m}>{m}</option>
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
                  {location === 'Online' ? 'Online' : mode}
                </p>
                {intake && <span className="intake-badge">Optional intake selected</span>}
              </>
            ) : (
              'Choose a location, provider, date and time to preview your booking.'
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
