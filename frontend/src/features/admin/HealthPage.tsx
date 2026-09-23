import { Card, Heading } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { ResourceState } from '../workflows/shared';
interface Health {
  checkedAt: string;
  api: {
    ok: boolean;
    service: string;
    uptimeSeconds: number;
    nodeVersion: string;
    environment: string;
  };
  database: {
    ok: boolean;
    responseMs: number;
    database_name: string;
    active_accounts: number;
    upcoming_appointments: number;
  };
  email: {
    ok: boolean;
    configured: boolean;
    host?: string;
    port?: number;
    error?: string;
    responseMs?: number;
  };
  sms: { ok: boolean; configured: boolean; status: string };
}
export default function HealthPage() {
  const resource = useResource<Health>('/admin/health'),
    h = resource.value;
  return (
    <section>
      <div className="section-title">
        <Heading
          title="System health"
          subtitle="Check the booking API, database, Email and SMS services."
        />
        <button className="btn" disabled={resource.loading} onClick={() => void resource.reload()}>
          Refresh status
        </button>
      </div>
      <ResourceState
        loading={resource.loading}
        error={resource.error}
        retry={() => void resource.reload()}
      />
      {h && (
        <>
          <div className="grid stats">
            {[
              [
                'Booking API',
                h.api.ok ? 'Operational' : 'Unavailable',
                `Uptime ${Math.floor(h.api.uptimeSeconds / 3600)}h ${Math.floor(h.api.uptimeSeconds / 60) % 60}m`,
              ],
              [
                'Database',
                h.database.ok ? 'Connected' : 'Unavailable',
                `${h.database.responseMs} ms response`,
              ],
              [
                'Email',
                h.email.configured ? (h.email.ok ? 'Connected' : 'Unavailable') : 'Not configured',
                h.email.host || 'SMTP details required',
              ],
              ['SMS', h.sms.configured ? 'Configured' : 'Not configured', 'Email / SMS delivery'],
            ].map(([title, value, note]) => (
              <Card key={title} title={title}>
                <h2>{value}</h2>
                <p className="sub">{note}</p>
              </Card>
            ))}
          </div>
          <div className="grid two space-top">
            <Card title="Application">
              {Object.entries(h.api).map(([key, value]) => (
                <div className="detail-row" key={key}>
                  <span>{key}</span>
                  <strong>{String(value)}</strong>
                </div>
              ))}
            </Card>
            <Card title="Database">
              {Object.entries(h.database).map(([key, value]) => (
                <div className="detail-row" key={key}>
                  <span>{key}</span>
                  <strong>{String(value)}</strong>
                </div>
              ))}
            </Card>
          </div>
          {h.email.error && <div className="notice space-top">{h.email.error}</div>}
          <p className="sub">Checked {new Date(h.checkedAt).toLocaleString('en-ZA')}</p>
        </>
      )}
    </section>
  );
}
