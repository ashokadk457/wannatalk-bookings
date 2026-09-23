import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Heading, Field } from '../../components/ui';
import { days, minutes, shortTime } from '../../lib/dates';
import { mutate } from '../../services/api';
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
    [busy, setBusy] = useState(false);
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
  return (
    <section>
      <Heading title="Availability" subtitle="Choose the hours patients may book with you." />
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
