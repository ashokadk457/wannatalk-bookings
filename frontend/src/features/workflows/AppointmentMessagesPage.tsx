import { useApp } from '../../app/AppContext';
import MessagesPage from './MessagesPage';
import { addDays, today } from '../../lib/dates';
export default function AppointmentMessagesPage() {
  const { data } = useApp();
  const tomorrow = addDays(today(), 1);
  const appointments = data.appointments.filter((a) => a.appointment_date >= tomorrow && !['Cancelled', 'No-show'].includes(a.status)).sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time));
  const patientIds = [...new Set(appointments.map((a) => a.patient_id))];
  return <MessagesPage appointmentMode appointmentOptions={appointments} defaultPatientIds={patientIds} defaultSubject="Appointment reminder" defaultMessage={'Hello {{patient_name}},\n\nThis is a reminder for your WannaTalk appointment on {{appointment_date}} from {{start_time}} to {{end_time}}.\nMode: {{mode}}'} />;
}
