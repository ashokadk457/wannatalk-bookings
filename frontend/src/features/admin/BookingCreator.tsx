import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Field } from '../../components/ui';
import Modal from '../../components/Modal';
import { providerTimes, slotProblem, today } from '../../lib/dates';
import { mutate } from '../../services/api';
import { PatientSelect, ProviderSelect } from '../workflows/shared';
export default function BookingCreator({ onClose }: { onClose: () => void }) {
  const { user, data, run, refresh, notify } = useApp();
  const [patientId, setPatient] = useState(''),
    [providerId, setProvider] = useState(user?.role === 'provider' ? user.entityId || '' : ''),
    [locationId, setLocation] = useState(''),
    [date, setDate] = useState(today()),
    [time, setTime] = useState(''),
    [type, setType] = useState('Individual counselling'),
    [mode, setMode] = useState('In-person'),
    [note, setNote] = useState(''),
    [intake, setIntake] = useState(false),
    [durationChoice, setDurationChoice] = useState(String(data.providers.find((p) => p.id === user?.entityId)?.default_duration_minutes || 60)),
    [customHours, setCustomHours] = useState('1'),
    [busy, setBusy] = useState(false);
  const provider = data.providers.find((p) => p.id === providerId),
    locations = data.locations.filter((l) => provider?.locations.includes(l.name)),
    location = locations.find((l) => l.id === locationId);
  const durationMinutes = durationChoice === 'custom' ? Math.round(Number(customHours) * 60) : Number(durationChoice);
  const slotProvider = provider ? { ...provider, default_duration_minutes: durationMinutes } : undefined;
  const slots = provider
    ? providerTimes(slotProvider!, date, location?.name).filter(
        (t) => !slotProblem(slotProvider!, date, t, data.appointments, undefined, location?.name),
      )
    : [];
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!provider || !location || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480 || !slots.includes(time))
      return notify('Choose a provider, location and available time');
    setBusy(true);
    const ok = await run(async () => {
      await mutate('/appointments', 'POST', {
        patientId,
        providerId,
        locationId,
        appointmentDate: date,
        appointmentTime: time,
        durationMinutes,
        appointmentType: type,
        mode: location.name === 'Online' ? 'Online' : mode,
        note,
        intakeRequested: intake,
      });
      await refresh();
    }, 'Booking created');
    setBusy(false);
    if (ok) onClose();
  }
  return (
    <Modal title="Create booking" onClose={onClose}>
      <div className="booking-creator-intro">Create a booking from live provider availability. The selected duration controls which start times remain available.</div>
      <form className="booking-creator-form" onSubmit={save}>
        <fieldset className="form-reset" disabled={busy}>
          <div className="form-grid">
            <PatientSelect value={patientId} onChange={setPatient} />
            {user?.role === 'admin' ? <ProviderSelect
              value={providerId}
              onChange={(id) => {
                setProvider(id);
                setDurationChoice(String(data.providers.find((p) => p.id === id)?.default_duration_minutes || 60));
                setLocation('');
                setTime('');
              }}
            /> : <Field label="Provider"><input disabled value={provider?.full_name || user?.fullName || ''} /></Field>}
            <Field label="Appointment duration">
              <select value={durationChoice} onChange={(e) => { setDurationChoice(e.target.value); setTime(''); }}>
                <option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="150">2.5 hours</option><option value="180">3 hours</option><option value="custom">Custom hours</option>
              </select>
            </Field>
            {durationChoice === 'custom' && <Field label="Custom duration (hours)"><input required type="number" min="0.25" max="8" step="0.25" value={customHours} onChange={(e) => { setCustomHours(e.target.value); setTime(''); }} /></Field>}
            <Field label="Location">
              <select required value={locationId} onChange={(e) => setLocation(e.target.value)}>
                <option value="">Choose location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Appointment date">
              <input
                required
                type="date"
                min={today()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime('');
                }}
              />
            </Field>
            <Field label="Available time">
              <select required value={time} onChange={(e) => setTime(e.target.value)}>
                <option value="">{slots.length ? 'Choose time' : 'No available slots'}</option>
                {slots.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
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
                disabled={location?.name === 'Online'}
                value={location?.name === 'Online' ? 'Online' : mode}
                onChange={(e) => setMode(e.target.value)}
              >
                {['In-person', 'Online', 'Telephone'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Note" full>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <label className="check-row">
              <input
                type="checkbox"
                checked={intake}
                onChange={(e) => setIntake(e.target.checked)}
              />
              Optional private intake
            </label>
          </div>
          <button className="btn space-top">{busy ? 'Saving…' : 'Create booking'}</button>
        </fieldset>
      </form>
    </Modal>
  );
}
