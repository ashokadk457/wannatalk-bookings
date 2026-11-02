import { useMemo, useState } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Field } from '../../components/ui';
import { addDays, formatDate, providerTimes, slotProblem, today } from '../../lib/dates';
import type { BookingDraft } from '../admin/BookingCreator';

type Slot = BookingDraft & { providerName: string; locationName: string };

export default function AvailableSlots({ providerIds, onBook }: { providerIds: string[]; onBook: (draft: BookingDraft) => void }) {
  const { data, notify } = useApp();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 7));
  const [duration, setDuration] = useState(60);
  const [locationId, setLocationId] = useState('');
  const [providerId, setProviderId] = useState(providerIds.length === 1 ? providerIds[0] : '');
  const locations = data.locations.filter((location) => location.name !== 'Online');
  const slots = useMemo(() => {
    const result: Slot[] = [];
    for (let date = from; date <= to && result.length < 500; date = addDays(date, 1)) {
      for (const provider of data.providers.filter((entry) => entry.is_active && (!providerIds.length || providerIds.includes(entry.id)) && (!providerId || providerId === entry.id))) {
        for (const location of locations.filter((entry) => !locationId || entry.id === locationId)) {
          const adjusted = { ...provider, default_duration_minutes: duration };
          for (const time of providerTimes(adjusted, date, location.name)) {
            if (!slotProblem(adjusted, date, time, data.appointments, undefined, location.name)) result.push({ providerId: provider.id, providerName: provider.full_name, locationId: location.id, locationName: location.name, date, time, durationMinutes: duration });
          }
        }
      }
    }
    return result.sort((a,b) => `${a.date}${a.time}${a.providerName}`.localeCompare(`${b.date}${b.time}${b.providerName}`));
  }, [data.appointments, data.providers, from, to, duration, locationId, locations, providerIds, providerId]);
  const share = async (slot: Slot) => {
    const text = `Available appointment with ${slot.providerName}: ${formatDate(slot.date)} at ${slot.time} (${slot.durationMinutes} min), ${slot.locationName}. Please let us know which time you prefer. Availability is subject to confirmation.`;
    try { await navigator.clipboard.writeText(text); notify('Availability message copied.'); } catch { notify(text); }
  };
  return <Card className="appointments-admin-card">
    <div className="appointments-toolbar"><div><strong>{slots.length} available slot{slots.length === 1 ? '' : 's'}</strong><span className="sub"> calculated from schedules, overrides, blocks and existing bookings</span></div></div>
    <div className="admin-filters">
      <Field label="Provider"><select value={providerId} onChange={(e) => setProviderId(e.target.value)}><option value="">All selected providers</option>{data.providers.filter((provider) => provider.is_active && (!providerIds.length || providerIds.includes(provider.id))).map((provider) => <option key={provider.id} value={provider.id}>{provider.full_name}</option>)}</select></Field>
      <Field label="From"><input type="date" min={today()} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      <Field label="To"><input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      <Field label="Duration"><select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[30,60,90,120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></Field>
      <Field label="Location"><select value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></Field>
    </div>
    <div className="dashboard-table"><table><thead><tr><th>Date</th><th>Time</th><th>Provider</th><th>Duration</th><th>Location</th><th>Actions</th></tr></thead><tbody>{slots.map((slot) => <tr key={`${slot.providerId}-${slot.locationId}-${slot.date}-${slot.time}`}><td>{formatDate(slot.date)}</td><td><strong>{slot.time}</strong></td><td>{slot.providerName}</td><td>{slot.durationMinutes} min</td><td>{slot.locationName}</td><td><div className="table-actions"><button className="icon-button" aria-label={`Book ${slot.providerName} ${slot.date} ${slot.time}`} data-tooltip="Book this slot" onClick={() => onBook(slot)}>＋</button><button className="icon-button" aria-label={`Copy ${slot.providerName} ${slot.date} ${slot.time}`} data-tooltip="Copy availability" onClick={() => void share(slot)}>⧉</button></div></td></tr>)}</tbody></table></div>
    {!slots.length && <div className="notice">No matching slots. Try another date range, provider, location or duration.</div>}
  </Card>;
}
