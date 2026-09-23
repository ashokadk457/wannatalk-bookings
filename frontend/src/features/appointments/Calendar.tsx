import { Fragment, useState } from 'react';
import { useApp } from '../../app/AppContext';
import { addDays, addMonths, dateOf, formatDate, minutes, statusClass, times, today, weekStart } from '../../lib/dates';
import { AppointmentActions, useAppointments } from './AppointmentContext';
import type { Appointment } from '../../types';
export type CalendarMode = 'day' | 'week' | 'month';
export function CalendarControls({ date, mode, onChange, title = 'Calendar view', subtitle = 'Appointments by day, week, or month.' }: { date: string; mode: CalendarMode; onChange: (date: string, mode: CalendarMode) => void; title?: string; subtitle?: string }) {
  const range = mode === 'month' ? dateOf(date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) : mode === 'day' ? formatDate(date) : `${formatDate(weekStart(date))} – ${formatDate(addDays(weekStart(date), 4))}`;
  return <div className="schedule-title"><div><h2>{title}</h2><p>{subtitle}</p></div><div className="top-actions"><span className="pill" aria-live="polite">{range}</span><button className="btn secondary" onClick={() => onChange(addMonths(date, -1), 'month')}>‹ Month</button><button className="btn secondary" onClick={() => onChange(addDays(date, -7), 'week')}>‹ Week</button><button className={`btn secondary ${mode === 'day' ? 'active' : ''}`} onClick={() => onChange(today(), 'day')}>Today</button><button className="btn secondary" onClick={() => onChange(addDays(date, 7), 'week')}>Week ›</button><button className="btn" onClick={() => onChange(addMonths(date, 1), 'month')}>Month ›</button></div></div>;
}
function Event({ appointment: a, compact = false }: { appointment: Appointment; compact?: boolean }) {
  const { user } = useApp(), actions = useAppointments();
  const title = user?.role === 'admin' ? `${a.patient_name} · ${a.provider_name}` : user?.role === 'patient' ? a.provider_name : a.patient_name;
  if (compact) return <button className={`month-event calendar-booking ${statusClass(a.status)}`} onClick={() => actions.open(a)}><strong>{a.appointment_time}</strong> {title}<br /><small>{a.location_name || a.mode} · {a.status}</small></button>;
  return <div className={`week-event calendar-booking ${statusClass(a.status)}`} tabIndex={0} onDoubleClick={() => actions.open(a)} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) actions.open(a); }}><span className="event-time">{a.appointment_time}</span><span className="event-label">{title}</span><small className="event-meta">{a.appointment_type} · {a.status}</small><div className="space-top"><AppointmentActions appointment={a} view /></div>{user?.role === 'provider' && <button className="btn secondary small space-top" onClick={() => actions.contact(a)}>Message</button>}</div>;
}
export default function Calendar({ appointments, initialDate, title }: { appointments: Appointment[]; initialDate?: string; title?: string }) {
  const [date, setDate] = useState(initialDate || today()), [mode, setMode] = useState<CalendarMode>('week');
  const start = mode === 'month' ? weekStart(`${date.slice(0, 7)}-01`) : mode === 'week' ? weekStart(date) : date;
  const dates = Array.from({ length: mode === 'month' ? 42 : mode === 'week' ? 5 : 1 }, (_, i) => addDays(start, i));
  const visible = appointments.filter(a => dates.includes(a.appointment_date));
  // Include nonstandard start times so an appointment never disappears from the grid.
  const rowTimes = [...new Set([...times, ...visible.map(a => a.appointment_time)])].sort();
  return <div className="calendar-content"><CalendarControls title={title} date={date} mode={mode} onChange={(d, m) => { setDate(d); setMode(m); }} /><p className="template-note">{visible.length} appointment{visible.length === 1 ? '' : 's'} showing</p>{mode === 'month' ? <div className="month-shell"><div className="month-board">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="month-head">{d}</div>)}{dates.map(d => <div key={d} className={`month-day ${d.slice(0, 7) !== date.slice(0, 7) ? 'muted' : ''}`}><div className="month-date">{dateOf(d).getDate()}</div>{visible.filter(a => a.appointment_date === d).map(a => <Event key={a.id} appointment={a} compact />)}</div>)}</div></div> : <div className={`week-shell reference-calendar ${mode === 'day' ? 'day-shell' : ''}`}><div className="week-board"><div className="week-cell week-head" />{dates.map(d => <div key={d} className="week-cell week-head">{dateOf(d).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}</div>)}{rowTimes.map((t, index) => <Fragment key={t}><div className="week-cell week-time">{t}</div>{dates.map(d => <div key={d} className="week-cell">{visible.filter(a => a.appointment_date === d && minutes(a.appointment_time) >= minutes(t) && minutes(a.appointment_time) < (rowTimes[index + 1] ? minutes(rowTimes[index + 1]) : 1440)).map(a => <Event key={a.id} appointment={a} />)}</div>)}</Fragment>)}</div></div>}</div>;
}
