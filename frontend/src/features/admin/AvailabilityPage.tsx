import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Card, Heading, ProviderStatus } from '../../components/ui';
import { days, initials, minutes, shortTime } from '../../lib/dates';
import Calendar from '../appointments/Calendar';
export default function AvailabilityPage() {
  const { data } = useApp(),
    state = useLocation().state as { providerId?: string } | null;
  const [selected, setSelected] = useState(
    state?.providerId || data.providers.find((p) => p.is_active)?.id || data.providers[0]?.id,
  );
  const providers = [...data.providers].sort(
      (a, b) => Number(b.is_active) - Number(a.is_active) || a.full_name.localeCompare(b.full_name),
    ),
    provider = providers.find((p) => p.id === selected);
  return (
    <section>
      <Heading
        title="Provider availability"
        subtitle="Review weekly schedules and bookable capacity."
      />
      <div className="workflow-layout">
        <Card title="Providers">
          <div className="workflow-list">
            {providers.map((p) => (
              <button
                className={`workflow-list-button ${p.id === selected ? 'active' : ''}`}
                key={p.id}
                onClick={() => setSelected(p.id)}
              >
                <strong>{p.full_name}</strong>
                <div className="sub">{p.professional_title}</div>
                <ProviderStatus active={p.is_active} online={p.is_online} />
              </button>
            ))}
          </div>
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
              <ProviderStatus active={provider.is_active} online={provider.is_online} />
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
            <Calendar
              key={provider.id}
              appointments={data.appointments.filter((a) => a.provider_id === provider.id)}
            />
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
    </section>
  );
}
