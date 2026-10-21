import { useEffect, useState } from 'react';
import type { DateRange } from '@daypicker/react';
import { useApp } from '../../app/AppContext';
import { Card, Field, Heading } from '../../components/ui';
import DateRangeFilter from '../../components/DateRangeFilter';
import { isoDate } from '../../lib/dates';
import { statuses } from '../../types';
import AppointmentTable from '../appointments/AppointmentTable';
import BookingCreator from './BookingCreator';
import RecurringBookingsTab from './RecurringBookingsTab';
export default function AppointmentsPage({ cancellations = false }: { cancellations?: boolean }) {
  const { data } = useApp();
  const [search, setSearch] = useState(''),
    [provider, setProvider] = useState(''),
    [status, setStatus] = useState(''),
    [range, setRange] = useState<DateRange | undefined>(undefined),
    [sort, setSort] = useState('soonest'),
    [create, setCreate] = useState(false),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(25);
  const [tab,setTab]=useState<'appointments'|'recurring'>('appointments');
  const apps = data.appointments
    .filter(
      (a) =>
        (cancellations
          ? ['Cancelled', 'No-show'].includes(a.status)
          : a.status !== 'Cancelled') &&
        (!provider || a.provider_id === provider) &&
        (!status || a.status === status) &&
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
  const currentPage = Math.min(page, pageCount);
  const visibleApps = apps.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [search, provider, status, range, sort, cancellations]);
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
        {!cancellations && tab==='appointments' && (
          <button className="btn" onClick={() => setCreate(true)}>
            ＋ Create booking
          </button>
        )}
      </div>
      {!cancellations&&<nav className="workflow-tabs" aria-label="Appointment booking views"><button className={tab==='appointments'?'active':''} onClick={()=>setTab('appointments')}>Appointments</button><button className={tab==='recurring'?'active':''} onClick={()=>setTab('recurring')}>Recurring bookings</button></nav>}
      {tab==='recurring'&&!cancellations?<RecurringBookingsTab createSingle={()=>setCreate(true)}/>:<Card className="appointments-admin-card">
        <div className="appointments-toolbar">
          <div><strong>{apps.length} appointment{apps.length === 1 ? '' : 's'}</strong><span className="sub"> matching the current filters</span></div>
          {(search || provider || status || range || sort !== 'soonest') && <button className="btn secondary small" onClick={() => { setSearch(''); setProvider(''); setStatus(''); setRange(undefined); setSort('soonest'); }}>Clear filters</button>}
        </div>
        <div className="admin-filters">
          <Field label="Search appointments">
            <input
              placeholder="Patient, provider or appointment type"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field label="Provider filter">
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="">All providers</option>
              {data.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </Field>
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
          <DateRangeFilter value={range} onChange={setRange} />
          <Field label="Sort appointments">
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="soonest">Soonest first</option>
              <option value="latest">Latest first</option>
            </select>
          </Field>
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
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, apps.length)} of {apps.length}
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
              <span className="pill">Page {currentPage} of {pageCount}</span>
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
      </Card>}
      {create && <BookingCreator onClose={() => setCreate(false)} />}
    </section>
  );
}
