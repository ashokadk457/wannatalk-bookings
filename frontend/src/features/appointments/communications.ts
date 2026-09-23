import type { Appointment } from '../../types';
import { formatDate } from '../../lib/dates';

export function reminder(appointment: Appointment) {
  return `WannaTalk reminder: your appointment with ${appointment.provider_name || 'your provider'} is on ${formatDate(appointment.appointment_date)} at ${appointment.appointment_time} (${appointment.location_name || appointment.mode}).`;
}
