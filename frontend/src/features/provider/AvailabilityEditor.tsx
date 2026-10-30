import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Field } from '../../components/ui';
import { days, minutes, shortTime, today } from '../../lib/dates';
import { api, mutate } from '../../services/api';
import type { Provider } from '../../types';

interface WeeklyTemplate { id:string; name:string; updated_at:string; rows:Array<{dayOfWeek:number;locationId:string|null;isAvailable:boolean;onlineBookingEnabled:boolean;startTime:string;endTime:string}> }

export default function AvailabilityEditor({ provider }: { provider: Provider }) {
  const { data, run, refresh, notify } = useApp();
  const locations = data.locations.filter((location) => location.name !== 'Online');
  const initialRows = useMemo(
    () =>
      days.map((_, day) => {
        const saved = provider.locationAvailability?.find(
          (entry) =>
            entry.day_of_week === day && entry.is_available && entry.location_name !== 'Online',
        );
        const fallback = provider.availability.find((entry) => entry.day_of_week === day);
        return {
          dayOfWeek: day,
          locationId: saved?.location_id || locations[0]?.id || '',
          isAvailable: saved?.is_available ?? fallback?.is_available ?? false,
          onlineBookingEnabled: saved?.online_booking_enabled ?? false,
          startTime: shortTime(saved?.start_time || fallback?.start_time || '09:00'),
          endTime: shortTime(saved?.end_time || fallback?.end_time || '17:00'),
        };
      }),
    [locations, provider.availability, provider.locationAvailability],
  );
  const [tab, setTab] = useState<'weekly' | 'unavailable'>('weekly');
  const [duration, setDuration] = useState(provider.default_duration_minutes);
  const [rows, setRows] = useState(initialRows),
    [busy, setBusy] = useState(false);
  const [templates,setTemplates]=useState<WeeklyTemplate[]>([]),[selectedTemplate,setSelectedTemplate]=useState('');
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [reason, setReason] = useState('');
  const change = (day: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((value) => value.map((row) => (row.dayOfWeek === day ? { ...row, ...patch } : row)));
  const loadTemplates=async()=>{try{const result=await api<{templates:WeeklyTemplate[]}>(`/providers/${provider.id}/weekly-templates`);setTemplates(result.templates);}catch(error){notify(error instanceof Error?error.message:'Unable to load weekly templates');}};
  useEffect(()=>{void loadTemplates();},[provider.id]);
  const templateRows=()=>rows.map(row=>({dayOfWeek:row.dayOfWeek,locationId:row.locationId||null,isAvailable:row.isAvailable,onlineBookingEnabled:row.onlineBookingEnabled,startTime:row.startTime,endTime:row.endTime}));
  async function saveTemplate(){const name=window.prompt('Name this weekly schedule template (for example, Standard practice week):');if(!name?.trim())return;await run(async()=>{await mutate(`/providers/${provider.id}/weekly-templates`,'POST',{name:name.trim(),rows:templateRows()});await loadTemplates();},'Weekly template saved');}
  function applyTemplate(){const template=templates.find(x=>x.id===selectedTemplate);if(!template)return;setRows(template.rows.map(row=>({dayOfWeek:row.dayOfWeek,locationId:row.locationId||locations[0]?.id||'',isAvailable:row.isAvailable,onlineBookingEnabled:row.onlineBookingEnabled,startTime:shortTime(row.startTime),endTime:shortTime(row.endTime)})));notify(`Applied “${template.name}”. Save weekly schedule to publish it.`);}
  async function overwriteTemplate(){const template=templates.find(x=>x.id===selectedTemplate);if(!template)return; if(!window.confirm(`Replace “${template.name}” with the current weekly schedule?`))return;await run(async()=>{await mutate(`/providers/${provider.id}/weekly-templates/${template.id}`,'PUT',{rows:templateRows()});await loadTemplates();},'Weekly template updated');}
  async function deleteTemplate(){const template=templates.find(x=>x.id===selectedTemplate);if(!template)return;if(!window.confirm(`Delete weekly template “${template.name}”?`))return;await run(async()=>{await mutate(`/providers/${provider.id}/weekly-templates/${template.id}`,'DELETE');setSelectedTemplate('');await loadTemplates();},'Weekly template deleted');}
  async function saveWeekly(e: FormEvent) {
    e.preventDefault();
    if (
      !rows.length ||
      rows.some(
        (r) => r.isAvailable && (!r.locationId || minutes(r.startTime) >= minutes(r.endTime)),
      )
    )
      return notify('Choose a location and valid start/end time for every available day');
    setBusy(true);
    await run(async () => {
      await mutate(`/providers/${provider.id}/availability`, 'PUT', {
        availability: rows.map((row) => ({
          dayOfWeek: row.dayOfWeek,
          isAvailable: row.isAvailable,
          startTime: row.startTime,
          endTime: row.endTime,
        })),
      });
      await Promise.all(
        locations.map((location) =>
          mutate(`/providers/${provider.id}/location-availability`, 'PUT', {
            locationId: location.id,
            availability: rows.map((row) => ({
              dayOfWeek: row.dayOfWeek,
              isAvailable: row.isAvailable && row.locationId === location.id,
              onlineBookingEnabled: row.isAvailable && row.locationId === location.id && row.onlineBookingEnabled,
              startTime: row.startTime,
              endTime: row.endTime,
            })),
          }),
        ),
      );
      await refresh();
    }, 'Weekly schedule saved');
    setBusy(false);
  }
  async function saveDuration() {
    await run(async () => {
      await mutate(`/providers/${provider.id}/profile`, 'PATCH', {
        fullName: provider.full_name,
        email: provider.email,
        mobile: provider.mobile || '',
        title: provider.title || '',
        professionalTitle: provider.professional_title,
        specialty: provider.specialty || '',
        subSpecialties: provider.sub_specialties || [],
        medicalRegistrationNumber: provider.medical_registration_number || '',
        practiceNumber: provider.practice_number || '',
        practiceSetting: provider.practice_setting || '',
        privatePracticeName: provider.private_practice_name || '',
        durationMinutes: duration,
        bio: provider.bio || '',
        locations: provider.locations,
      });
      await refresh();
    }, 'Default slot duration saved');
  }
  async function saveUnavailable(e: FormEvent) {
    e.preventDefault();
    if (!from) return;
    if ((start && !end) || (!start && end) || (start && end && minutes(start) >= minutes(end)))
      return notify('Enter both start and end time, with end after start');
    await run(async () => {
      const last = to || from;
      for (
        let d = new Date(`${from}T00:00:00`);
        d <= new Date(`${last}T00:00:00`);
        d.setDate(d.getDate() + 1)
      ) {
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        await mutate(`/providers/${provider.id}/unavailable`, 'POST', {
          locationId: null,
          date,
          startTime: start || null,
          endTime: end || null,
          reason,
        });
      }
      await refresh();
      setFrom('');
      setTo('');
      setStart('');
      setEnd('');
      setReason('');
    }, 'Global unavailability saved');
  }
  async function removeUnavailable(kind: 'day' | 'slot', id: string, label: string) {
    if (!window.confirm(`Remove unavailability for ${label}?`)) return;
    await run(async () => {
      await mutate(`/providers/${provider.id}/unavailable/${kind}/${id}`, 'DELETE');
      await refresh();
    }, 'Unavailability removed');
  }
  return (
    <Card>
      <div className="availability-duration-bar">
        <div>
          <strong>Default slot duration</strong>
          <span className="sub">Used to generate available booking times.</span>
        </div>
        <select
          aria-label="Default slot duration"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        >
          {[30, 60, 90, 120].map((n) => (
            <option value={n} key={n}>
              {n} minutes
            </option>
          ))}
        </select>
        <button type="button" className="btn secondary small" onClick={() => void saveDuration()}>
          Save duration
        </button>
      </div>
      <div className="tabs">
        <button
          className={`btn ${tab === 'weekly' ? '' : 'secondary'}`}
          onClick={() => setTab('weekly')}
        >
          Weekly schedule
        </button>
        <button
          className={`btn ${tab === 'unavailable' ? '' : 'secondary'}`}
          onClick={() => setTab('unavailable')}
        >
          Manage unavailability
        </button>
      </div>
      {tab === 'weekly' ? (
        <form onSubmit={saveWeekly}>
          <section className="weekly-template-library" aria-label="Weekly schedule templates">
            <div className="weekly-template-copy"><strong>Weekly template library</strong><span>Reuse a proven weekly pattern, then save your schedule when ready.</span></div>
            <div className="weekly-template-controls"><select aria-label="Weekly schedule template" value={selectedTemplate} onChange={e=>setSelectedTemplate(e.target.value)}><option value="">Choose a saved template</option>{templates.map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select><button type="button" className="btn secondary small" disabled={!selectedTemplate} onClick={applyTemplate}>Apply</button><button type="button" className="btn secondary small" onClick={()=>void saveTemplate()}>Save as new</button>{selectedTemplate&&<><button type="button" className="btn secondary small" onClick={()=>void overwriteTemplate()}>Update</button><button type="button" className="btn danger small" onClick={()=>void deleteTemplate()}>Delete</button></>}</div>
          </section>
          <div className="notice">
            Select the physical location where this provider works on each weekday. Enable online
            booking only for the days and locations where it may use the same time interval.
          </div>
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Location</th>
                  <th>Start time</th>
                  <th>End time</th>
                  <th>Available</th>
                  <th>Online booking</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.dayOfWeek}>
                    <td>
                      <strong>{days[row.dayOfWeek]}</strong>
                    </td>
                    <td>
                      <select
                        aria-label={`${days[row.dayOfWeek]} location`}
                        disabled={!row.isAvailable || !locations.length}
                        value={row.locationId}
                        onChange={(e) => change(row.dayOfWeek, { locationId: e.target.value })}
                      >
                        {!locations.length && <option value="">No physical location</option>}
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        disabled={!row.isAvailable}
                        type="time"
                        value={row.startTime}
                        onChange={(e) => change(row.dayOfWeek, { startTime: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        disabled={!row.isAvailable}
                        type="time"
                        value={row.endTime}
                        onChange={(e) => change(row.dayOfWeek, { endTime: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.isAvailable}
                        onChange={(e) =>
                          change(row.dayOfWeek, {
                            isAvailable: e.target.checked,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input type="checkbox" role="switch" aria-label={`${days[row.dayOfWeek]} online booking`} disabled={!row.isAvailable} checked={row.onlineBookingEnabled} onChange={(e) => change(row.dayOfWeek, { onlineBookingEnabled: e.target.checked })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button disabled={busy} className="btn space-top">
            {busy ? 'Saving…' : 'Save weekly schedule'}
          </button>
        </form>
      ) : (
        <>
          <div className="notice">
            Unavailable days and time slots apply to every location for this provider.
          </div>
          <form onSubmit={saveUnavailable}>
            <div className="form-grid">
              <Field label="From date">
                <input
                  required
                  min={today()}
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label="To date (optional)">
                <input
                  min={from || today()}
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
              <Field label="Start time (optional)">
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="End time (optional)">
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
              <Field label="Reason / holiday name">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Holiday, leave, unavailable…"
                />
              </Field>
            </div>
            <button className="btn space-top">Add unavailability</button>
          </form>
          <div className="space-top">
            {(provider.unavailableDays || []).map((d) => (
              <div className="detail-row" key={d.id}>
                <span>{d.unavailable_date.slice(0, 10)} · Full day</span>
                <strong>{d.reason || 'Unavailable'}</strong>
                <button
                  type="button"
                  className="btn danger small"
                  aria-label={`Remove unavailable day ${d.unavailable_date.slice(0, 10)}`}
                  onClick={() => void removeUnavailable('day', d.id, d.unavailable_date.slice(0, 10))}
                >
                  Remove
                </button>
              </div>
            ))}
            {(provider.unavailableSlots || []).map((s) => (
              <div className="detail-row" key={s.id}>
                <span>
                  {s.unavailable_date.slice(0, 10)} · {shortTime(s.start_time)}–
                  {shortTime(s.end_time)}
                </span>
                <strong>{s.reason || 'Unavailable'}</strong>
                <button
                  type="button"
                  className="btn danger small"
                  aria-label={`Remove unavailable time slot ${s.unavailable_date.slice(0, 10)}`}
                  onClick={() => void removeUnavailable('slot', s.id, `${s.unavailable_date.slice(0, 10)} ${shortTime(s.start_time)}–${shortTime(s.end_time)}`)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
