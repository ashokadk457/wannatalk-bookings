import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Card, Field, Heading } from '../../components/ui';
import { days, initials, minutes, shortTime } from '../../lib/dates';
import AvailabilityEditor from '../provider/AvailabilityEditor';
export default function AvailabilityPage() {
  const { data } = useApp(),
    state = useLocation().state as { providerId?: string } | null;
  const [selected, setSelected] = useState(
    state?.providerId || data.providers.find((p) => p.is_active)?.id || data.providers[0]?.id,
  );
  const providers = [...data.providers].sort(
      (a, b) => Number(b.is_active) - Number(a.is_active) || a.full_name.localeCompare(b.full_name),
    ),
    provider = providers.find((p) => p.id === selected) || providers[0];
  return (
    <section>
      <Heading
        title="Provider availability"
        subtitle="Review weekly schedules and bookable capacity."
      />
      <div className="provider-availability-layout">
        <Card>
          <Field label="Provider">
            <select
              value={provider?.id || ''}
              onChange={(event) => setSelected(event.target.value)}
              disabled={!providers.length}
            >
              {!providers.length && <option value="">No providers configured</option>}
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                  {p.professional_title ? ` — ${p.professional_title}` : ''}
                  {' · '}
                  {!p.is_active ? 'Inactive' : 'Configured per day'}
                </option>
              ))}
            </select>
          </Field>
        </Card>
        {provider ? (
          <Card>
            <div className="profile-header">
              <div className="profile-left">
                <div className="big-avatar">{initials(provider.full_name)}</div>
                <div>
                  <h3>{provider.full_name}</h3>
                  <div className="sub">
                    {provider.professional_title} · {provider.locations.join(', ')}
                  </div>
                </div>
              </div>
              <span
                className={`status ${!provider.is_active ? 'cancelled' : 'confirmed'}`}
              >
                {!provider.is_active ? 'Inactive' : 'Online settings are day-wise'}
              </span>
            </div>
            <span className="pill">
              {provider.availability
                .filter((a) => a.is_available)
                .reduce(
                  (sum, a) => sum + Math.max(0, minutes(a.end_time) - minutes(a.start_time)),
                  0,
                ) / 60}{' '}
              hrs/week
            </span>
            {days.map((d, i) => {
              const a = provider.availability.find((a) => a.day_of_week === i);
              return (
                <div className="detail-row" key={d}>
                  <span>{d}</span>
                  <strong>
                    {a?.is_available
                      ? `${shortTime(a.start_time)}–${shortTime(a.end_time)}`
                      : 'Unavailable'}
                  </strong>
                </div>
              );
            })}
          </Card>
        ) : (
          <div className="notice">No providers configured.</div>
        )}
      </div>
      {provider && (
        <div className="space-top">
          <AvailabilityEditor key={provider.id} provider={provider} />
        </div>
      )}
    </section>
  );
}
