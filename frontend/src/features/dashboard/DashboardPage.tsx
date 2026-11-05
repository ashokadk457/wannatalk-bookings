import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Card, Stat, StatusPill } from '../../components/ui';
import { addDays, formatDate, providerTimes, slotProblem, today, weekStart } from '../../lib/dates';
import { useResource } from '../../hooks/useResource';
import Calendar from '../appointments/Calendar';
import AppointmentTable from '../appointments/AppointmentTable';
import BookingCreator from '../admin/BookingCreator';
import type { FollowUp } from '../../types';

function DashboardActionIcon({
  name,
  color,
}: {
  name: 'view-appointment' | 'edit-appointment' | 'message-patient' | 'cancel-appointment';
  color: 'green' | 'orange' | 'red';
}) {
  return <img src={`/assets/action-icons/${name}_${color}.svg`} alt="" aria-hidden="true" />;
}

function PracticeMetric({
  to,
  label,
  value,
  note,
  icon,
  tone = '',
}: {
  to: string;
  label: string;
  value: string | number;
  note: string;
  icon: string;
  tone?: 'orange' | 'red' | '';
}) {
  return (
    <Link className="practice-stat" to={to}>
      <span className={`practice-stat-icon ${tone}`}>{icon}</span>
      <span>
        <span className="practice-stat-label">{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </span>
    </Link>
  );
}

function PracticePanel({
  title,
  hint,
  action,
  children,
  className = '',
}: {
  title: string;
  hint: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`practice-panel ${className}`}>
      <header>
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        {action}
      </header>
      <div className="practice-panel-content">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const { user, data } = useApp(),
    admin = user?.role === 'admin';
  const [createBooking, setCreateBooking] = useState(false);
  const [providerFilter, setProviderFilter] = useState('all');
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const followUpResource = useResource<{ followUps: FollowUp[] }>('/follow-ups');
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
  const recentActivity = [...data.auditLogs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  const selectedProvider = providerFilter === 'all' ? null : data.providers.find((p) => p.id === providerFilter);
  const periodStart = period === 'today' ? today() : weekStart(today());
  const periodEnd = period === 'today' ? periodStart : addDays(periodStart, 6);
  const scopedApps = apps.filter(
    (a) =>
      (!selectedProvider || a.provider_id === selectedProvider.id) &&
      a.appointment_date >= periodStart &&
      a.appointment_date <= periodEnd,
  );
  const scopedBookings = scopedApps.filter((a) => !['Cancelled', 'No-show'].includes(a.status));
  const scopedCompleted = scopedApps.filter((a) => a.status === 'Completed');
  const scopedInvoiceRows = [...new Map(
    scopedApps
      .filter((a) => a.invoice_id || a.billing_review || a.appointment_passed_unpaid)
      .map((a) => [a.invoice_id || `appointment:${a.id}`, a]),
  ).values()];
  const scopedOutstanding = scopedInvoiceRows.filter((a) => Number(a.outstanding_balance || 0) > 0);
  const scopedBillingIssues = scopedInvoiceRows.filter((a) => a.billing_review || a.appointment_passed_unpaid);
  const outstandingTotal = scopedOutstanding.reduce((sum, a) => sum + Number(a.outstanding_balance || 0), 0);
  const scopedProviders = selectedProvider ? [selectedProvider] : data.providers;
  const providersWithoutAvailability = scopedProviders.filter(
    (p) =>
      p.is_active &&
      !p.availability.some((slot) => slot.is_available) &&
      !p.locationAvailability?.some((slot) => slot.is_available) &&
      !p.availabilityOverrides?.some(
        (entry) => entry.availability_type === 'Available' && entry.override_date.slice(0, 10) >= today(),
      ),
  ).length;
  const scopedOpenFollowUps = (followUpResource.value?.followUps || []).filter(
    (followUp) =>
      followUp.status === 'open' &&
      (!selectedProvider || followUp.provider_id === selectedProvider.id) &&
      followUp.due_at.slice(0, 10) <= periodEnd,
  );
  const attentionItems = [
    { label: 'Appointments awaiting confirmation', count: scopedApps.filter((a) => a.status === 'Booked').length, to: '/admin/appointments' },
    { label: 'Follow-ups to send', count: scopedOpenFollowUps.length, to: '/admin/followups' },
    { label: 'Outstanding client payments', count: scopedOutstanding.length, to: '/admin/billing/outstanding' },
    { label: 'Schedule availability to review', count: providersWithoutAvailability, to: '/admin/availability' },
  ];
  const availabilityRows = scopedProviders.map((provider) => {
    if (!provider.is_active) return { provider, status: 'Inactive', next: 'Provider inactive' };
    let nextDate = '';
    let nextTime = '';
    for (let offset = 0; offset < 14 && !nextTime; offset++) {
      const date = addDays(today(), offset);
      const locationNames = provider.locations.length ? provider.locations : [undefined];
      for (const locationName of locationNames) {
        const availableTime = providerTimes(provider, date, locationName).find(
          (time) => !slotProblem(provider, date, time, apps, undefined, locationName),
        );
        if (availableTime) {
          nextDate = date;
          nextTime = availableTime;
          break;
        }
      }
    }
    return {
      provider,
      status: nextDate === today() ? 'Available' : 'Unavailable today',
      next: nextTime ? `${nextDate === today() ? 'Today' : formatDate(nextDate)} · ${nextTime}` : 'No open slot in next 14 days',
    };
  });
  return (
    <section className={admin ? 'dashboard-prototype' : undefined}>
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
      {!admin && <div className="grid stats">
        <Link className="dashboard-stat-link" to={`/${user?.role}/appointments`}>
          <Stat
            icon="▣"
            color="blue"
            label={admin ? "Today's bookings" : "Today's appointments"}
            value={todays.length}
            note={`${todays.filter((a) => a.status === 'Confirmed').length} confirmed · ${todays.filter((a) => a.status === 'Booked').length} booked`}
          />
        </Link>
        <Link className="dashboard-stat-link" to={admin ? '/admin/providers' : `/${user?.role}/patients`}>
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
        </Link>
        <Link className="dashboard-stat-link" to={`/${user?.role}/appointments`}>
          <Stat
            icon="✓"
            color="purple"
            label="Completed"
            value={completed.length}
            note="Sessions completed"
          />
        </Link>
        <Link className="dashboard-stat-link" to={`/${user?.role}/cancellations`}>
          <Stat
            icon="!"
            color="red"
            label="Cancelled / no-show"
            value={cancelled.length}
            note="Follow-up suggested"
          />
        </Link>
      </div>}
      {admin ? (
        <>
          <div className="practice-toolbar">
            <label><span>Provider</span><select value={providerFilter} onChange={(e) => { setProviderFilter(e.target.value); setShowAllAppointments(false); }}><option value="all">All permitted providers</option>{data.providers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
            <label><span>Period</span><select value={period} onChange={(e) => { setPeriod(e.target.value as 'today' | 'week'); setShowAllAppointments(false); }}><option value="today">Today · {formatDate(today())}</option><option value="week">This week</option></select></label>
            <span className="practice-toolbar-spacer" />
            <Link className="practice-btn primary" to="/admin/appointments">＋ Create booking</Link>
            <Link className="practice-btn" to="/admin/calendar">▦ Calendar</Link>
          </div>
          <div className="practice-summary">
            <PracticeMetric to="/admin/appointments" icon="▣" label={period === 'today' ? "Today's bookings" : 'This week bookings'} value={scopedBookings.length} note="Confirmed and booked sessions" />
            <PracticeMetric to="/admin/appointments" icon="✓" label="Completed" value={scopedCompleted.length} note="Sessions finished" />
            <PracticeMetric to="/admin/followups" icon="!" tone="orange" label="Needs attention" value={attentionItems.reduce((sum, item) => sum + item.count, 0)} note="Pending practice tasks" />
            <PracticeMetric to="/admin/billing/outstanding" icon="R" tone="red" label="Outstanding" value={scopedOutstanding.length} note={`R ${outstandingTotal.toFixed(2)} invoice balance`} />
          </div>
          <div className="practice-main-grid">
            <PracticePanel title={period === 'today' ? "Today's appointments" : "This week's appointments"} hint={`${scopedApps.length} appointments for ${selectedProvider?.full_name || 'all permitted providers'}`} action={<Link className="practice-btn small" to="/admin/appointments">View all</Link>}>
              <div className="practice-appointment-list">
                {(showAllAppointments ? scopedApps : scopedApps.slice(0, 5)).map((a) => <div className="practice-appointment" key={a.id}>
                  <span className="practice-time">{a.appointment_time}<small>{a.duration_minutes} min</small></span>
                  <span className="practice-person"><strong>{a.patient_name}</strong><small>{a.appointment_type} · {a.provider_name}{a.location_name ? ` · ${a.location_name}` : ''}</small></span>
                  <StatusPill status={a.status} />
                  <span className="practice-iconbar">
                    <Link className="practice-actionicon" to="/admin/appointments" title="View appointment" aria-label="View appointment"><DashboardActionIcon name="view-appointment" color="green" /></Link>
                    <Link className="practice-actionicon" to="/admin/appointments" title="Edit appointment" aria-label="Edit appointment"><DashboardActionIcon name="edit-appointment" color="green" /></Link>
                    <Link className="practice-actionicon" to="/admin/appointment-messages" title="Message patient" aria-label="Message patient"><DashboardActionIcon name="message-patient" color="red" /></Link>
                    <Link className="practice-actionicon" to="/admin/cancellations" title="Cancel appointment" aria-label="Cancel appointment"><DashboardActionIcon name="cancel-appointment" color="red" /></Link>
                  </span>
                </div>)}
                {!scopedApps.length && <p className="practice-empty">No appointments in this period.</p>}
              </div>
              {scopedApps.length > 5 && <div className="practice-show-more"><button className="practice-btn small" onClick={() => setShowAllAppointments((value) => !value)}>{showAllAppointments ? 'Show fewer appointments' : 'Show all appointments'}</button></div>}
            </PracticePanel>
            <PracticePanel title="Needs attention" hint="Outstanding items requiring attention" action={<span className="practice-demo-pill">Select an item</span>}>
              <div className="practice-attention-list">{attentionItems.map((item) => <Link className="practice-attention" to={item.to} key={item.label}><span>{item.label}</span><b>{item.count}</b><i>›</i></Link>)}</div>
            </PracticePanel>
            <PracticePanel title="Quick actions" hint="Common tasks, one click away">
              <div className="practice-quick-grid">
                {[['/admin/appointments','▦','New booking'],['/admin/patients','⌕','Find patient'],['/admin/appointments','◷','Appointments'],['/admin/messages','✉','Send message'],['/admin/availability','▤','My availability'],['/admin/billing/overview','R','Billing']].map(([to, icon, label]) => <Link className="practice-quick" to={to} key={label}><span>{icon}</span><b>{label}</b></Link>)}
              </div>
              <div className="practice-strip"><span>Scheduled hours and ad-hoc availability overrides</span><Link className="practice-btn small" to="/admin/availability">Manage availability</Link></div>
            </PracticePanel>
            <PracticePanel title="Practice pulse" hint="Operational overview for the selected period" action={<Link className="practice-btn small" to="/admin/billing/overview">View report</Link>}>
              <div className="practice-table">{[['Confirmed sessions', scopedApps.filter((a) => a.status === 'Confirmed').length],['Booked sessions', scopedApps.filter((a) => a.status === 'Booked').length],['Cancelled / no-show', scopedApps.filter((a) => ['Cancelled', 'No-show'].includes(a.status)).length],['Follow-ups pending', scopedOpenFollowUps.length],['Invoices needing review', scopedBillingIssues.length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
              <div className="practice-strip"><span>Operational data from the selected period</span><Link className="practice-btn small" to="/admin/billing/overview">Billing overview</Link></div>
            </PracticePanel>
            <PracticePanel title="Provider availability" hint="Who is available for bookings?" className="practice-provider-panel" action={<Link className="practice-btn small" to="/admin/availability">View slots</Link>}>
              <div className="practice-table availability"><div className="head"><span>Provider</span><span>Status</span><span>Next available</span></div>{availabilityRows.map(({ provider, status, next }) => <div key={provider.id}><span>{provider.full_name}</span><StatusPill status={status} /><span>{next}</span></div>)}</div>
            </PracticePanel>
            <PracticePanel title="Recent admin activity" hint="Important practice updates" className="practice-activity-panel" action={<Link className="practice-btn small" to="/admin/audit">Audit log</Link>}>
              <div className="practice-table activity">{recentActivity.length ? recentActivity.map((entry) => <div key={entry.id}><span><strong>{entry.action}</strong><small>{entry.user_name}</small></span><span>{new Date(entry.created_at).toLocaleString('en-ZA')}</span></div>) : <p className="practice-empty">No recent admin activity.</p>}</div>
            </PracticePanel>
          </div>
        </>
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
