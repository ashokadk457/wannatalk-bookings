import { useEffect, useRef, useState } from 'react';
import type { DateRange } from '@daypicker/react';
import { useApp } from '../../app/AppContext';
import { Card, Field, Heading } from '../../components/ui';
import DateRangeFilter from '../../components/DateRangeFilter';
import { dateOf, isoDate, today } from '../../lib/dates';
import { statuses } from '../../types';
import AppointmentTable from '../appointments/AppointmentTable';
import Calendar from '../appointments/Calendar';
import BookingCreator from './BookingCreator';
import RecurringBookingsTab from './RecurringBookingsTab';
const providerFilterStorageKey = 'wannatalkAdminAppointmentProviders';

function savedProviderFilters() {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(providerFilterStorageKey) || '[]');
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function ProviderFilter({
  options,
  value,
  onChange,
}: {
  options: { id: string; full_name: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const label = !value.length
    ? 'All providers'
    : value.length === 1
      ? options.find((provider) => provider.id === value[0])?.full_name || '1 provider'
      : `${value.length} providers selected`;
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!detailsRef.current?.contains(event.target as Node)) detailsRef.current?.removeAttribute('open');
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        detailsRef.current?.removeAttribute('open');
        detailsRef.current?.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  return (
    <details ref={detailsRef} className="provider-filter-select">
      <summary aria-label="Provider filters">
        <span>{label}</span>
        <span className="provider-filter-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="provider-filter-options">
        <button type="button" className="provider-filter-all" onClick={() => onChange([])}>
          All providers
        </button>
        {options.map((provider) => (
          <label key={provider.id} className={value.includes(provider.id) ? 'selected' : ''}>
            <input
              type="checkbox"
              checked={value.includes(provider.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, provider.id]
                    : value.filter((id) => id !== provider.id),
                )
              }
            />
            <span>{provider.full_name}</span>
          </label>
        ))}
        <div className="provider-filter-footer">
          <button
            type="button"
            className="btn small"
            onClick={() => detailsRef.current?.removeAttribute('open')}
          >
            Done
          </button>
        </div>
      </div>
    </details>
  );
}

export default function AppointmentsPage({ cancellations = false }: { cancellations?: boolean }) {
  const { user, data } = useApp();
  const admin = user?.role === 'admin';
  const [search, setSearch] = useState(''),
    [providers, setProviders] = useState<string[]>(savedProviderFilters),
    [status, setStatus] = useState(''),
    [duration, setDuration] = useState(''),
    [range, setRange] = useState<DateRange | undefined>(
      cancellations ? undefined : { from: dateOf(today()) },
    ),
    [sort, setSort] = useState('soonest'),
    [create, setCreate] = useState(false),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(25);
  const [tab, setTab] = useState<'appointments' | 'calendar' | 'recurring'>('appointments');
  const apps = data.appointments
    .filter(
      (a) =>
        (cancellations ? ['Cancelled', 'No-show'].includes(a.status) : a.status !== 'Cancelled') &&
        (!providers.length || providers.includes(a.provider_id)) &&
        (!status || a.status === status) &&
        (!duration || a.duration_minutes === Number(duration)) &&
        (!range?.from || a.appointment_date >= isoDate(range.from)) &&
        (!range?.to || a.appointment_date <= isoDate(range.to)) &&
        `${a.patient_name} ${a.provider_name} ${a.appointment_type} ${a.mode}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (a.appointment_date + a.appointment_time).localeCompare(
          b.appointment_date + b.appointment_time,
        ) * (sort === 'latest' ? -1 : 1),
    );
  const pageCount = Math.max(1, Math.ceil(apps.length / pageSize));
  const durationOptions = [...new Set(data.appointments.map((a) => a.duration_minutes))]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const currentPage = Math.min(page, pageCount);
  const visibleApps = apps.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const customRange = Boolean(
    range?.to || (range?.from && isoDate(range.from) !== today()) || (cancellations && range?.from),
  );

  useEffect(() => {
    setPage(1);
  }, [search, providers, status, duration, range, sort, cancellations]);
  useEffect(() => {
    localStorage.setItem(providerFilterStorageKey, JSON.stringify(providers));
  }, [providers]);
  useEffect(() => {
    const valid = new Set(data.providers.map((provider) => provider.id));
    setProviders((current) => {
      const next = current.filter((id) => valid.has(id));
      return next.length === current.length ? current : next;
    });
  }, [data.providers]);
  return (
    <section>
      <div className="section-title">
        <Heading
          title={cancellations ? 'Cancellations & no-shows' : 'All appointments'}
          subtitle={
            cancellations
              ? 'Track lost appointments across the practice.'
              : 'Search, filter and update every booking.'
          }
        />
        {!cancellations && tab !== 'recurring' && (
          <button className="btn" onClick={() => setCreate(true)}>
            ＋ Create booking
          </button>
        )}
      </div>
      {!cancellations && (
        <nav className="workflow-tabs" aria-label="Appointment booking views">
          <button
            className={tab === 'appointments' ? 'active' : ''}
            onClick={() => setTab('appointments')}
          >
            Appointments
          </button>
          <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>
            Calendar
          </button>
          {admin && <button
              className={tab === 'recurring' ? 'active' : ''}
              onClick={() => setTab('recurring')}
            >
              Recurring bookings
            </button>}
        </nav>
      )}
      {tab === 'recurring' && !cancellations ? (
        <RecurringBookingsTab createSingle={() => setCreate(true)} />
      ) : tab === 'calendar' && !cancellations ? (
        <Card className="appointments-admin-card">
          <div className="appointments-toolbar">
            <div>
              <strong>
                {apps.length} appointment{apps.length === 1 ? '' : 's'}
              </strong>
              <span className="sub"> matching the current filters</span>
            </div>
            {(search || providers.length || status || duration || customRange) && (
              <button
                className="btn secondary small"
                onClick={() => {
                  setSearch('');
                  setProviders([]);
                  setStatus('');
                  setDuration('');
                  setRange({ from: dateOf(today()) });
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="admin-filters calendar-filters">
            <Field label="Search appointments">
              <input
                placeholder="Patient, provider or appointment type"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            {admin && <Field label="Provider filter">
              <ProviderFilter options={data.providers} value={providers} onChange={setProviders} />
            </Field>}
            <Field label="Status filter">
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                {statuses
                  .filter((s) => s !== 'Cancelled')
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </Field>
            <Field label="Duration filter">
              <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="">All durations</option>
                {durationOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </Field>
            <DateRangeFilter
              value={range}
              onChange={(next) => setRange(next || { from: dateOf(today()) })}
            />
          </div>
          <Calendar appointments={apps} title="Appointment calendar" />
        </Card>
      ) : (
        <Card className="appointments-admin-card">
          <div className="appointments-toolbar">
            <div>
              <strong>
                {apps.length} appointment{apps.length === 1 ? '' : 's'}
              </strong>
              <span className="sub"> matching the current filters</span>
            </div>
            {(search ||
              providers.length ||
              status ||
              duration ||
              customRange ||
              sort !== 'soonest') && (
              <button
                className="btn secondary small"
                onClick={() => {
                  setSearch('');
                  setProviders([]);
                  setStatus('');
                  setDuration('');
                  setRange(cancellations ? undefined : { from: dateOf(today()) });
                  setSort('soonest');
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="admin-filters">
            <Field label="Search appointments">
              <input
                placeholder="Patient, provider or appointment type"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            {admin && <Field label="Provider filter">
              <ProviderFilter options={data.providers} value={providers} onChange={setProviders} />
            </Field>}
            <Field label="Status filter">
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                {statuses
                  .filter((s) => cancellations || s !== 'Cancelled')
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </Field>
            <Field label="Duration filter">
              <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="">All durations</option>
                {durationOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </Field>
            <DateRangeFilter
              value={range}
              onChange={(next) =>
                setRange(next || (cancellations ? undefined : { from: dateOf(today()) }))
              }
            />
            {/* <Field label="Sort appointments">
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="soonest">Soonest first</option>
              <option value="latest">Latest first</option>
            </select>
          </Field> */}
            <Field label="Rows per page">
              <select
                className="pagination_select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </Field>
          </div>
          <AppointmentTable appointments={visibleApps} editable bulkMessaging fullInvoiceEditor />
          {apps.length > 0 && (
            <div className="pagination-controls">
              <span>
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, apps.length)} of {apps.length}
              </span>
              <div className="actions">
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={currentPage === 1}
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                >
                  Previous
                </button>
                <span className="pill">
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
      {create && <BookingCreator onClose={() => setCreate(false)} />}
    </section>
  );
}
