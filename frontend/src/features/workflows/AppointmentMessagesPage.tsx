import { useMemo, useState } from 'react';
import { useApp } from '../../app/AppContext';
import MessagesPage from './MessagesPage';
import { today } from '../../lib/dates';
export default function AppointmentMessagesPage() {
  const { data } = useApp();
  const [range, setRange] = useState('24'), [startDate, setStartDate] = useState(''), [endDate, setEndDate] = useState('');
  const now = new Date();
  const horizon = range === 'all' ? null : Number(range) * 60 * 60 * 1000;
  const appointments = useMemo(() => data.appointments.filter((a) => {
    if (['Cancelled', 'No-show'].includes(a.status)) return false;
    const when = new Date(`${a.appointment_date}T${a.appointment_time}`).getTime();
    if (!Number.isFinite(when) || when < now.getTime()) return false;
    if (horizon !== null && when > now.getTime() + horizon) return false;
    if (startDate && a.appointment_date < startDate) return false;
    if (endDate && a.appointment_date > endDate) return false;
    return true;
  }).sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time)), [data.appointments, range, startDate, endDate]);
  const patientIds = [...new Set(appointments.map((a) => a.patient_id))];
  return <section><div className="admin-filters"><label>Appointments starting within<select value={range} onChange={(e) => setRange(e.target.value)}><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">2 days</option><option value="72">3 days</option><option value="168">7 days</option><option value="all">All upcoming</option></select></label><label>Start date<input type="date" min={today()} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label>End date<input type="date" min={today()} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></div><MessagesPage key={`${range}-${startDate}-${endDate}`} appointmentMode appointmentOptions={appointments} defaultPatientIds={patientIds} defaultSubject="Appointment reminder" defaultMessage={'This is a reminder for {{patient_name}} about your WannaTalk appointment on {{appointment_date}} from {{start_time}} to {{end_time}}.\nMode: {{mode}}'} /></section>;
}
