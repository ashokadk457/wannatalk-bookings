import { Fragment } from 'react';
import { CalendarControls, type CalendarMode } from './Calendar';
import { addDays, dateOf, minutes, providerTimes, slotProblem, timeString, weekStart } from '../../lib/dates';
import { useApp } from '../../app/AppContext';
import type { Provider } from '../../types';
export default function SlotCalendar({ providers, date, mode, selectedTime, selectedProvider, location, onNavigate, onSelect }: { providers: Provider[]; date: string; mode: CalendarMode; selectedTime: string; selectedProvider: string; location: string; onNavigate: (date: string, mode: CalendarMode) => void; onSelect: (date: string, provider: string, time: string) => void }) {
  const { data } = useApp();
  const start = mode === 'month' ? weekStart(`${date.slice(0, 7)}-01`) : mode === 'week' ? weekStart(date) : date;
  const dates = Array.from({ length: mode === 'month' ? 42 : mode === 'week' ? 5 : 1 }, (_, i) => addDays(start, i));
  const times = [...new Set(dates.flatMap(d => providers.flatMap(p => providerTimes(p, d))))].sort();
  function slots(d: string, t: string, compact = false) {
    return providers.filter(p => providerTimes(p, d).includes(t)).map(p => {
      const problem = slotProblem(p, d, t, data.appointments), past = problem?.startsWith('Past'), chosen = d === date && selectedTime === t && selectedProvider === p.id;
      return <button key={p.id + t} disabled={!!problem} title={problem || `Book ${p.full_name} at ${t}`} className={`${compact ? 'month-event' : 'week-event'} ${past ? 'past' : problem ? 'unavailable' : chosen ? 'booked' : 'available'}`} onClick={() => onSelect(d, p.id, t)}><span className="event-time">{t}{!compact && ` – ${timeString(minutes(t) + p.default_duration_minutes)}`}</span><span className="event-label">{p.full_name}</span><small className="event-meta">{past ? 'Past time' : problem ? 'Not available' : chosen ? 'Selected' : 'Available'} · {location}{p.is_online ? '' : ' · Provider offline'}</small></button>;
    });
  }
  return <><CalendarControls date={date} mode={mode} onChange={onNavigate} subtitle="Choose an available green slot. Grey slots are booked or blocked." /><p className="template-note">{mode} view · booked and blocked times loaded from the database</p>{mode === 'month' ? <div className="month-shell"><div className="month-board">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div className="month-head" key={d}>{d}</div>)}{dates.map(d => <div className={`month-day ${d.slice(0, 7) === date.slice(0, 7) ? '' : 'muted'}`} key={d}><div className="month-date"><button className="mini-day" onClick={() => onNavigate(d, 'day')}>{dateOf(d).getDate()}</button></div>{times.flatMap(t => slots(d, t, true)).slice(0, 4)}<button className="btn secondary small" onClick={() => onNavigate(d, 'day')}>View day</button></div>)}</div></div> : times.length ? <div className={`week-shell reference-calendar ${mode === 'day' ? 'day-shell' : ''}`}><div className="week-board"><div className="week-cell week-head" />{dates.map(d => <div className="week-cell week-head" key={d}>{dateOf(d).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}</div>)}{times.map(t => <Fragment key={t}><div className="week-cell week-time">{t}</div>{dates.map(d => <div className="week-cell" key={d}>{slots(d, t)}</div>)}</Fragment>)}</div></div> : <div className="notice">No provider availability is configured for this {mode}.</div>}</>;
}
