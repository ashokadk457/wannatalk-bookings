import { useState } from 'react';
import type { DateRange } from '@daypicker/react';
import { useApp } from '../../app/AppContext';
import { Card, Field, Heading } from '../../components/ui';
import DateRangeFilter from '../../components/DateRangeFilter';
import { isoDate } from '../../lib/dates';
import { statuses } from '../../types';
import AppointmentTable from '../appointments/AppointmentTable';
import BookingCreator from './BookingCreator';
export default function AppointmentsPage({ cancellations = false }: { cancellations?: boolean }) {
  const { data } = useApp();
  const [search, setSearch] = useState(''),
    [provider, setProvider] = useState(''),
    [status, setStatus] = useState(''),
    [range, setRange] = useState<DateRange | undefined>(undefined),
    [sort, setSort] = useState('soonest'),
    [create, setCreate] = useState(false);
  const apps = data.appointments
    .filter(
      (a) =>
        (!cancellations || ['Cancelled', 'No-show'].includes(a.status)) &&
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
        {!cancellations && (
          <button className="btn" onClick={() => setCreate(true)}>
            ＋ Create booking
          </button>
        )}
      </div>
      <Card>
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
              {statuses.map((s) => (
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
        </div>
        <AppointmentTable appointments={apps} editable />
      </Card>
      {create && <BookingCreator onClose={() => setCreate(false)} />}
    </section>
  );
}
