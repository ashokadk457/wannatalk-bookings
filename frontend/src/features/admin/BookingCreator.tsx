import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Field } from '../../components/ui';
import Modal from '../../components/Modal';
import { providerTimes, slotProblem, today } from '../../lib/dates';
import { mutate } from '../../services/api';
import { PatientSelect } from '../workflows/shared';
export default function BookingCreator({ onClose }: { onClose: () => void }) {
  const { user, data, run, refresh, notify } = useApp();
  const [patientId, setPatient] = useState(''),
    [providerId, setProvider] = useState(user?.role === 'provider' ? user.entityId || '' : ''),
    [locationId, setLocation] = useState(''),
    [date, setDate] = useState(today()),
    [time, setTime] = useState(''),
    [type, setType] = useState('Individual counselling'),
    [mode, setMode] = useState(''),
    [note, setNote] = useState(''),
    [intake, setIntake] = useState(false),
    [durationChoice, setDurationChoice] = useState('60'),
    [busy, setBusy] = useState(false);
  const locations = data.locations.filter((l) => l.name !== 'Online'),
    location = locations.find((l) => l.id === locationId),
    eligibleProviders = data.providers.filter(
      (p) =>
        p.is_active &&
        Boolean(location) &&
        (mode === 'Online'
          ? p.is_online
          : mode === 'In-person' && p.locations.includes(location!.name)),
    ),
    provider = eligibleProviders.find((p) => p.id === providerId);
  const durationMinutes = Number(durationChoice);
  const slotProvider = provider
    ? { ...provider, default_duration_minutes: durationMinutes }
    : undefined;
  const slots = provider
    ? providerTimes(slotProvider!, date, mode === 'Online' ? 'Online' : location?.name).filter(
        (t) =>
          !slotProblem(
            slotProvider!,
            date,
            t,
            data.appointments,
            undefined,
            mode === 'Online' ? 'Online' : location?.name,
          ),
      )
    : [];
  async function save(e: FormEvent) {
    e.preventDefault();
    if (
      !provider ||
      !location ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 15 ||
      durationMinutes > 480 ||
      !slots.includes(time)
    )
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
        mode,
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
      <div className="booking-creator-intro">
        Create a booking from live provider availability. The selected duration controls which start
        times remain available.
      </div>
      <form className="booking-creator-form" onSubmit={save}>
        <fieldset className="form-reset" disabled={busy}>
          <div className="form-grid">
            <Field label="Location">
              <select
                required
                value={locationId}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setMode('');
                  if (user?.role === 'admin') setProvider('');
                  setTime('');
                }}
              >
                <option value="">Choose physical location first</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Booking format">
              <select
                required
                disabled={!locationId}
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  if (user?.role === 'admin') setProvider('');
                  setTime('');
                }}
              >
                <option value="">Choose Online or Physical</option>
                <option value="In-person">Physical</option>
                <option value="Online">Online</option>
              </select>
            </Field>
            <PatientSelect
              value={patientId}
              onChange={setPatient}
              allowCreate={user?.role === 'admin'}
            />
            {user?.role === 'admin' ? (
              <Field label="Provider">
                <select
                  required
                  disabled={!locationId || !mode}
                  value={providerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setProvider(id);
                    setDurationChoice('60');
                    setTime('');
                  }}
                >
                  <option value="">Choose available provider</option>
                  {eligibleProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Provider">
                <input disabled value={provider?.full_name || user?.fullName || ''} />
              </Field>
            )}
            <Field label="Appointment duration">
              <select
                value={durationChoice}
                onChange={(e) => {
                  setDurationChoice(e.target.value);
                  setTime('');
                }}
              >
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
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
