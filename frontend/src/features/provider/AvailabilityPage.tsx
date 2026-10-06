import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Field } from '../../components/ui';
import { days, minutes, shortTime } from '../../lib/dates';
import { mutate } from '../../services/api';
import { api } from '../../services/api';
export default function AvailabilityPage() {
  const { user, data, run, refresh, notify } = useApp(),
    provider = data.providers.find((p) => p.id === user?.entityId);
  const [rows, setRows] = useState(() =>
      days.map((_, day) => {
        const a = provider?.availability.find((a) => a.day_of_week === day);
        return {
          dayOfWeek: day,
          isAvailable: a?.is_available || false,
          startTime: shortTime(a?.start_time || '09:00'),
          endTime: shortTime(a?.end_time || '17:00'),
        };
      }),
    ),
    [busy, setBusy] = useState(false),
    [locationId, setLocationId] = useState(''),
    [unavailableDate, setUnavailableDate] = useState(''),
    [unavailableStart, setUnavailableStart] = useState(''),
    [unavailableEnd, setUnavailableEnd] = useState(''),
    [unavailableReason, setUnavailableReason] = useState('');
  const locationOptions = data.locations.filter((l) => provider?.locations.includes(l.name));
  useEffect(() => { if (!locationId && locationOptions[0]) setLocationId(locationOptions[0].id); }, [locationId, locationOptions]);
  function change(day: number, patch: Partial<(typeof rows)[number]>) {
    setRows((v) => v.map((a, i) => (i === day ? { ...a, ...patch } : a)));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!provider) return;
    if (rows.some((r) => r.isAvailable && minutes(r.startTime) >= minutes(r.endTime)))
      return notify('End time must be after start time');
    setBusy(true);
    await run(async () => {
      await mutate(`/providers/${provider.id}/availability`, 'PUT', { availability: rows });
      await refresh();
    }, 'Availability saved to WannaTalk');
    setBusy(false);
  }
  async function saveUnavailable(e: FormEvent) {
    e.preventDefault(); if (!provider || !unavailableDate) return;
    await run(async () => { await mutate(`/providers/${provider.id}/unavailable`, 'POST', { locationId: locationId || null, date: unavailableDate, startTime: unavailableStart || null, endTime: unavailableEnd || null, reason: unavailableReason }); await refresh(); setUnavailableDate(''); setUnavailableStart(''); setUnavailableEnd(''); setUnavailableReason(''); }, 'Unavailable period saved');
  }
  async function saveLocationSchedule() {
    if (!provider || !locationId) return notify('Choose a location first');
    setBusy(true);
    await run(async () => { await mutate(`/providers/${provider.id}/location-availability`, 'PUT', { locationId, availability: rows }); await refresh(); }, 'Location schedule saved');
    setBusy(false);
  }
  return (
    <section>
      <Card>
        <div className="notice">
          Patients will only see booking times that fall within these hours and are not already
          booked.
        </div>
        <form onSubmit={save}>
          <fieldset className="form-reset" disabled={busy}>
            {rows.map((row, day) => (
              <div className="availrow" key={day}>
                <strong>{days[day]}</strong>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={row.isAvailable}
                    onChange={(e) => change(day, { isAvailable: e.target.checked })}
                  />
                  Available
                </label>
                <Field label={`${days[day]} start`}>
                  <input
                    type="time"
                    required
                    value={row.startTime}
                    onChange={(e) => change(day, { startTime: e.target.value })}
                  />
                </Field>
                <Field label={`${days[day]} end`}>
                  <input
                    type="time"
                    required
                    value={row.endTime}
                    onChange={(e) => change(day, { endTime: e.target.value })}
                  />
                </Field>
              </div>
            ))}
            <button className="btn space-top">
              {busy ? 'Saving…' : 'Save weekly availability'}
            </button>
          </fieldset>
        </form>
        <hr />
        <h3>Location schedule</h3>
        <div className="notice">Set the selected location’s schedule. Existing global hours remain the fallback for locations without a saved schedule.</div>
        <Field label="Location"><select value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">All locations / global schedule</option>{locationOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
        <button className="btn secondary space-top" type="button" disabled={busy} onClick={() => void saveLocationSchedule()}>Save this location schedule</button>
        <h3 className="space-top">Unavailable day or time slot</h3>
        <form onSubmit={saveUnavailable}><div className="form-grid"><Field label="Date"><input required type="date" value={unavailableDate} onChange={(e) => setUnavailableDate(e.target.value)} /></Field><Field label="Start time (optional)"><input type="time" value={unavailableStart} onChange={(e) => setUnavailableStart(e.target.value)} /></Field><Field label="End time (optional)"><input type="time" value={unavailableEnd} onChange={(e) => setUnavailableEnd(e.target.value)} /></Field><Field label="Reason"><input value={unavailableReason} onChange={(e) => setUnavailableReason(e.target.value)} /></Field></div><button className="btn space-top">Save unavailable period</button></form>
        {!!provider?.blocks.length && (
          <>
            <h3>Blocked times</h3>
            {provider.blocks.map((b) => (
              <div className="detail-row" key={b.id}>
                <span>
                  {b.block_date.slice(0, 10)} · {shortTime(b.start_time)}–{shortTime(b.end_time)}
                </span>
                <strong>{b.reason || 'Unavailable'}</strong>
              </div>
            ))}
          </>
        )}
      </Card>
    </section>
  );
}
