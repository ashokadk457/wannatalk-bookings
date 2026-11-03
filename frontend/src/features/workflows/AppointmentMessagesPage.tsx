import { useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useApp } from '../../app/AppContext';
import MessagesPage from './MessagesPage';
import { today } from '../../lib/dates';
export default function AppointmentMessagesPage() {
  const { data } = useApp();
  const initial = useLocation().state as { patientIds?: string[]; includeCancelled?: boolean } | null;
  const includeCancelled = Boolean(initial?.includeCancelled);
  const selectedPatientIds = initial?.patientIds || [];
  const [range, setRange] = useState(includeCancelled ? 'all' : '24'), [startDate, setStartDate] = useState(''), [endDate, setEndDate] = useState('');
  const now = new Date();
  const horizon = range === 'all' ? null : Number(range) * 60 * 60 * 1000;
  const appointments = useMemo(() => data.appointments.filter((a) => {
    if (includeCancelled) {
      if (!['Cancelled', 'No-show'].includes(a.status)) return false;
      if (selectedPatientIds.length && !selectedPatientIds.includes(a.patient_id)) return false;
    } else if (['Cancelled', 'No-show'].includes(a.status)) return false;
    const when = new Date(`${a.appointment_date}T${a.appointment_time}`).getTime();
    if (!includeCancelled) {
      if (!Number.isFinite(when) || when < now.getTime()) return false;
      if (horizon !== null && when > now.getTime() + horizon) return false;
      if (startDate && a.appointment_date < startDate) return false;
      if (endDate && a.appointment_date > endDate) return false;
    }
    return true;
  }).sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time)), [data.appointments, range, startDate, endDate, includeCancelled, selectedPatientIds]);
  const patientIds = [...new Set(appointments.map((a) => a.patient_id))];
  return <section><div className="admin-filters">{!includeCancelled && <label>Appointments starting within<select value={range} onChange={(e) => setRange(e.target.value)}><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">2 days</option><option value="72">3 days</option><option value="168">7 days</option><option value="all">All upcoming</option></select></label>}{!includeCancelled && <label>Start date<input type="date" min={today()} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>}{!includeCancelled && <label>End date<input type="date" min={today()} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>}</div><MessagesPage key={`${range}-${startDate}-${endDate}-${includeCancelled}`} appointmentMode appointmentOptions={appointments} defaultPatientIds={patientIds} includeCancelled={includeCancelled} defaultSubject={includeCancelled ? 'Appointment cancellation notice' : 'Appointment reminder'} defaultMessage={includeCancelled ? 'Your WannaTalk appointment with {{provider_name}} on {{appointment_date}} at {{start_time}} has been cancelled. Please contact us if you need help.' : 'This is a reminder for {{patient_name}} about your WannaTalk appointment on {{appointment_date}} from {{start_time}} to {{end_time}}.\nMode: {{mode}}'} /></section>;
}
