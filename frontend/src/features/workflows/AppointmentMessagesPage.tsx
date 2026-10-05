import { useApp } from '../../app/AppContext';
import MessagesPage from './MessagesPage';
import { addDays, today } from '../../lib/dates';
export default function AppointmentMessagesPage() {
  const { data } = useApp();
  const tomorrow = addDays(today(), 1);
  const patientIds = [...new Set(data.appointments.filter((a) => a.appointment_date === tomorrow && !['Cancelled', 'No-show'].includes(a.status)).map((a) => a.patient_id))];
  const lines = data.appointments.filter((a) => a.appointment_date === tomorrow && patientIds.includes(a.patient_id)).map((a) => `${a.patient_name}: ${a.appointment_date} at ${a.appointment_time} (${a.mode})`);
  return <MessagesPage appointmentMode defaultPatientIds={patientIds} defaultSubject="Appointment reminder" defaultMessage={`Reminder: you have a WannaTalk appointment tomorrow.\n${lines.join('\n')}`} />;
}
