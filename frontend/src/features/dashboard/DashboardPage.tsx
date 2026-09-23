import { Link } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Card, ProviderStatus, Stat } from '../../components/ui';
import { today } from '../../lib/dates';
import Calendar from '../appointments/Calendar';
import AppointmentTable from '../appointments/AppointmentTable';
export default function DashboardPage() {
  const { user, data } = useApp(),
    admin = user?.role === 'admin';
  const apps = [...data.appointments].sort((a, b) =>
    (a.appointment_date + a.appointment_time).localeCompare(
      b.appointment_date + b.appointment_time,
    ),
  );
  const todays = apps.filter((a) => a.appointment_date === today()),
    completed = apps.filter((a) => a.status === 'Completed'),
    cancelled = apps.filter((a) => ['Cancelled', 'No-show'].includes(a.status));
  const online = data.providers.filter((p) => p.is_active && p.is_online).length,
    upcoming = apps
      .filter((a) => a.appointment_date >= today() && !['Cancelled', 'No-show'].includes(a.status))
      .slice(0, 6);
  return (
    <section>
      <div className="grid stats">
        <Stat
          icon="▣"
          color="blue"
          label={admin ? "Today's bookings" : "Today's appointments"}
          value={todays.length}
          note={`${todays.filter((a) => a.status === 'Confirmed').length} confirmed · ${todays.filter((a) => a.status === 'Booked').length} booked`}
        />
        <Stat
          icon="●"
          color="green"
          label={admin ? 'Providers online' : 'Patients'}
          value={admin ? online : new Set(apps.map((a) => a.patient_id)).size}
          note={
            admin
              ? `${data.providers.length - online} offline · ${data.providers.length} total`
              : 'Captured from bookings'
          }
        />
        <Stat
          icon="✓"
          color="purple"
          label="Completed"
          value={completed.length}
          note="Sessions completed"
        />
        <Stat
          icon="!"
          color="red"
          label="Cancelled / no-show"
          value={cancelled.length}
          note="Follow-up suggested"
        />
      </div>
      <div className="grid two space-top flex-box">
        <Card title={admin ? 'Upcoming appointments' : "Today's appointments"}>
          <AppointmentTable appointments={admin ? upcoming : todays} />
        </Card>
        <div className="grid">
          <Card title={admin ? 'Practice health' : "Today's overview"}>
            {admin &&
              data.providers.map((p) => (
                <div className="detail-row" key={p.id}>
                  <strong>{p.full_name}</strong>
                  <ProviderStatus active={p.is_active} online={p.is_online} />
                </div>
              ))}
            <div className="quick-list space-top">
              {(admin
                ? [
                    ['registrations', 'Register client/provider'],
                    ['appointments', 'Manage appointments'],
                    ['availability', 'Check provider availability'],
                  ]
                : [
                    ['calendar', 'View calendar'],
                    ['availability', 'Edit weekly availability'],
                    ['messages', 'Send a message'],
                  ]
              ).map(([path, label]) => (
                <Link className="btn secondary" key={path} to={`/${user?.role}/${path}`}>
                  {label}
                </Link>
              ))}
            </div>
          </Card>
          <Card title="Quick actions">
            <div className="quick-list">
              <Link className="btn" to={`/${user?.role}/followups`}>
                View follow-ups
              </Link>
              <Link
                className="btn secondary"
                to={`/${user?.role}/${admin ? 'patients' : 'patients'}`}
              >
                View patients
              </Link>
            </div>
          </Card>
        </div>
      </div>
      <div className="space-top">
        <Calendar appointments={apps} />
      </div>
    </section>
  );
}
