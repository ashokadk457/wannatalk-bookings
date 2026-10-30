import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Card, Stat, StatusPill } from '../../components/ui';
import { today } from '../../lib/dates';
import Calendar from '../appointments/Calendar';
import AppointmentTable from '../appointments/AppointmentTable';
import BookingCreator from '../admin/BookingCreator';
export default function DashboardPage() {
  const { user, data } = useApp(),
    admin = user?.role === 'admin';
  const [createBooking, setCreateBooking] = useState(false);
  const apps = [...data.appointments].sort((a, b) =>
    (a.appointment_date + a.appointment_time).localeCompare(
      b.appointment_date + b.appointment_time,
    ),
  );
  const todays = apps.filter((a) => a.appointment_date === today()),
    completed = apps.filter((a) => a.status === 'Completed'),
    cancelled = apps.filter((a) => ['Cancelled', 'No-show'].includes(a.status));
  const activeProviders = data.providers.filter((p) => p.is_active).length;
  const inactiveProviders = data.providers.filter((p) => !p.is_active).length;
  const providersWithoutAvailability = data.providers.filter(
    (p) => p.is_active && !p.availability.some((slot) => slot.is_available),
  ).length;
  const billingIssues = apps.filter((a) => a.billing_review || a.appointment_passed_unpaid).length;
  const recentActivity = [...data.auditLogs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  return (
    <section>
      {user?.role === 'provider' && (
        <div className="dashboard-primary-action">
          <div>
            <strong>Create an appointment</strong>
            <span className="sub">
              Choose one of your patients, duration, location and available time.
            </span>
          </div>
          <button className="btn" onClick={() => setCreateBooking(true)}>
            ＋ New booking
          </button>
        </div>
      )}
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
          label={admin ? 'Active providers' : 'Patients'}
          value={admin ? activeProviders : new Set(apps.map((a) => a.patient_id)).size}
          note={
            admin
              ? `${inactiveProviders} inactive · ${data.providers.length} total`
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
      {admin ? (
        <div className="grid two space-top dashboard-overview-panel">
          <Card title="Needs attention">
            <div className="quick-list">
              <Link className="btn secondary" to="/admin/registrations">
                Pending registrations <span className="pill">{data.registrations.length}</span>
              </Link>
              <Link className="btn secondary" to="/admin/availability">
                Providers without availability{' '}
                <span className="pill">{providersWithoutAvailability}</span>
              </Link>
              <Link className="btn secondary" to="/admin/providers">
                Inactive providers <span className="pill">{inactiveProviders}</span>
              </Link>
              <Link className="btn secondary" to="/admin/billing/outstanding">
                Billing items requiring review <span className="pill">{billingIssues}</span>
              </Link>
            </div>
          </Card>
          <Card title="Practice health">
            {data.providers.map((p) => (
              <div className="detail-row" key={p.id}>
                <strong>{p.full_name}</strong>
                <StatusPill status={p.is_active ? 'Active' : 'Inactive'} />
              </div>
            ))}
            <div className="quick-list space-top">
              <Link className="btn secondary" to="/admin/availability">
                Check provider availability
              </Link>
              <Link className="btn secondary" to="/admin/health">
                View system health
              </Link>
            </div>
          </Card>
          <Card title="Quick actions">
            <div className="quick-list">
              <Link className="btn" to="/admin/registrations">
                Register client/provider
              </Link>
              <Link className="btn secondary" to="/admin/followups">
                View follow-ups
              </Link>
              <Link className="btn secondary" to="/admin/patients">
                View patients
              </Link>
              <Link className="btn secondary" to="/admin/appointments">
                Manage appointments
              </Link>
            </div>
          </Card>
          <Card title="Recent admin activity">
            {recentActivity.length ? (
              recentActivity.map((entry) => (
                <div className="detail-row" key={entry.id}>
                  <span>
                    <strong>{entry.action}</strong>
                    <small>{entry.user_name}</small>
                  </span>
                  <span className="sub">{new Date(entry.created_at).toLocaleString('en-ZA')}</span>
                </div>
              ))
            ) : (
              <p className="sub">No recent admin activity.</p>
            )}
            <div className="quick-list space-top">
              <Link className="btn secondary" to="/admin/audit">
                View full audit log
              </Link>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid two space-top flex-box">
          <Card title="Upcoming appointments">
            <AppointmentTable
              appointments={apps
                .filter(
                  (a) =>
                    a.appointment_date >= today() && !['Cancelled', 'No-show'].includes(a.status),
                )
                .slice(0, 20)}
              bulkMessaging
            />
          </Card>
          <div className="grid dashboard-overview-panel">
            <Card title="Today's overview">
              <div className="quick-list space-top">
                {[
                  ['calendar', 'View calendar'],
                  ['availability', 'Edit weekly availability'],
                  ['messages', 'Send a message'],
                ].map(([path, label]) => (
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
                <Link className="btn secondary" to={`/${user?.role}/patients`}>
                  View patients
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}
      {!admin && (
        <div className="space-top">
          <Calendar appointments={apps} />
        </div>
      )}
      {createBooking && <BookingCreator onClose={() => setCreateBooking(false)} />}
    </section>
  );
}
