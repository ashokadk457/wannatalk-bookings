import { useMemo, useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Field } from '../../components/ui';
import { days, minutes, shortTime, today } from '../../lib/dates';
import { mutate } from '../../services/api';
import type { Provider } from '../../types';

export default function AvailabilityEditor({ provider }: { provider: Provider }) {
  const { data, run, refresh, notify } = useApp();
  const locations = data.locations.filter((l) => provider.locations.includes(l.name));
  const initialRows = useMemo(() => days.map((_, day) => {
    const saved = provider.locationAvailability?.find((a) => a.day_of_week === day && a.is_available);
    const fallback = provider.availability.find((a) => a.day_of_week === day);
    return { dayOfWeek: day, locationId: saved?.location_id || locations[0]?.id || '', isAvailable: saved?.is_available ?? fallback?.is_available ?? false, startTime: shortTime(saved?.start_time || fallback?.start_time || '09:00'), endTime: shortTime(saved?.end_time || fallback?.end_time || '17:00') };
  }), [provider.id]);
  const [tab, setTab] = useState<'weekly'|'unavailable'>('weekly');
  const [rows, setRows] = useState(initialRows), [busy, setBusy] = useState(false);
  const [locationId, setLocationId] = useState(locations[0]?.id || ''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState(''), [reason, setReason] = useState('');
  const change = (day: number, patch: Partial<(typeof rows)[number]>) => setRows((v) => v.map((r) => r.dayOfWeek === day ? { ...r, ...patch } : r));
  async function saveWeekly(e: FormEvent) {
    e.preventDefault();
    if (rows.some((r) => r.isAvailable && (!r.locationId || minutes(r.startTime) >= minutes(r.endTime)))) return notify('Choose a location and valid start/end time for every available day');
    setBusy(true);
    await run(async () => {
      for (const location of locations) await mutate(`/providers/${provider.id}/location-availability`, 'PUT', { locationId: location.id, availability: days.map((_, day) => { const row = rows[day]; return { dayOfWeek: day, isAvailable: row.isAvailable && row.locationId === location.id, startTime: row.startTime, endTime: row.endTime }; }) });
      await refresh();
    }, 'Weekly location schedule saved'); setBusy(false);
  }
  async function saveUnavailable(e: FormEvent) {
    e.preventDefault(); if (!from) return;
    if ((start && !end) || (!start && end) || (start && end && minutes(start) >= minutes(end))) return notify('Enter both start and end time, with end after start');
    await run(async () => { const last = to || from; for (let d = new Date(`${from}T00:00:00`); d <= new Date(`${last}T00:00:00`); d.setDate(d.getDate()+1)) { const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; await mutate(`/providers/${provider.id}/unavailable`, 'POST', { locationId: locationId || null, date, startTime: start || null, endTime: end || null, reason }); } await refresh(); setFrom(''); setTo(''); setStart(''); setEnd(''); setReason(''); }, 'Unavailability saved');
  }
  return <Card>
    <div className="tabs"><button className={`btn ${tab==='weekly'?'':'secondary'}`} onClick={() => setTab('weekly')}>Weekly schedule</button><button className={`btn ${tab==='unavailable'?'':'secondary'}`} onClick={() => setTab('unavailable')}>Manage unavailability</button></div>
    {tab === 'weekly' ? <form onSubmit={saveWeekly}><div className="dashboard-table"><table><thead><tr><th>Day</th><th>Location</th><th>Start time</th><th>End time</th><th>Available</th></tr></thead><tbody>{rows.map((row) => <tr key={row.dayOfWeek}><td><strong>{days[row.dayOfWeek]}</strong></td><td><select disabled={!row.isAvailable} value={row.locationId} onChange={(e) => change(row.dayOfWeek,{locationId:e.target.value})}>{locations.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select></td><td><input disabled={!row.isAvailable} type="time" value={row.startTime} onChange={(e)=>change(row.dayOfWeek,{startTime:e.target.value})}/></td><td><input disabled={!row.isAvailable} type="time" value={row.endTime} onChange={(e)=>change(row.dayOfWeek,{endTime:e.target.value})}/></td><td><input type="checkbox" checked={row.isAvailable} onChange={(e)=>change(row.dayOfWeek,{isAvailable:e.target.checked})}/></td></tr>)}</tbody></table></div><button disabled={busy} className="btn space-top">{busy?'Saving…':'Save weekly schedule'}</button></form> : <><form onSubmit={saveUnavailable}><div className="form-grid"><Field label="Location"><select value={locationId} onChange={(e)=>setLocationId(e.target.value)}><option value="">All locations</option>{locations.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field><Field label="From date"><input required min={today()} type="date" value={from} onChange={(e)=>setFrom(e.target.value)}/></Field><Field label="To date (optional)"><input min={from||today()} type="date" value={to} onChange={(e)=>setTo(e.target.value)}/></Field><Field label="Start time (optional)"><input type="time" value={start} onChange={(e)=>setStart(e.target.value)}/></Field><Field label="End time (optional)"><input type="time" value={end} onChange={(e)=>setEnd(e.target.value)}/></Field><Field label="Reason / holiday name"><input value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Holiday, leave, unavailable…"/></Field></div><button className="btn space-top">Add unavailability</button></form><div className="space-top">{(provider.unavailableDays || []).map((d)=><div className="detail-row" key={d.id}><span>{d.unavailable_date.slice(0,10)} · Full day</span><strong>{d.reason||'Unavailable'}</strong></div>)}{(provider.unavailableSlots || []).map((s)=><div className="detail-row" key={s.id}><span>{s.unavailable_date.slice(0,10)} · {shortTime(s.start_time)}–{shortTime(s.end_time)}</span><strong>{s.reason||'Unavailable'}</strong></div>)}</div></>}
  </Card>;
}
