import type { Appointment, Provider } from '../types';
export const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const times = ['09:00', '10:30', '12:00', '14:00', '15:30', '16:00'];
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const today = () => isoDate(new Date());
export const dateOf = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};
export const shortTime = (value: string) => value.slice(0, 5);
export const formatDate = (value: string) =>
  dateOf(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
export function addDays(value: string, amount: number) {
  const d = dateOf(value);
  d.setDate(d.getDate() + amount);
  return isoDate(d);
}
export function addMonths(value: string, amount: number) {
  const d = dateOf(value),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + amount);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return isoDate(d);
}
export function weekStart(value: string) {
  return addDays(value, -((dateOf(value).getDay() + 6) % 7));
}
export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const timeString = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export const isPast = (date: string, time: string) =>
  !Number.isFinite(new Date(`${date}T${time}`).getTime()) ||
  new Date(`${date}T${time}`) <= new Date();
export const active = (a: Appointment) => !['Cancelled', 'No-show', 'Completed'].includes(a.status);
export const occupiesSlot = (a: Appointment) => !['Cancelled', 'No-show'].includes(a.status);
export const statusClass = (status: string) => status.toLowerCase();
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
export function slotProblem(
  provider: Provider,
  date: string,
  time: string,
  appointments: Appointment[],
  excludeId?: string,
) {
  if (isPast(date, time)) return 'Past dates and times cannot be booked';
  if (!provider.is_active) return 'This provider is inactive';
  if (!provider.is_online) return 'This provider is currently offline';
  const availability = provider.availability.find((a) => a.day_of_week === dateOf(date).getDay());
  const start = minutes(time),
    end = start + provider.default_duration_minutes;
  if (
    !availability?.is_available ||
    start < minutes(availability.start_time) ||
    end > minutes(availability.end_time)
  )
    return 'Outside provider availability';
  if (
    provider.blocks.some(
      (b) =>
        b.block_date.slice(0, 10) === date &&
        start < minutes(b.end_time) &&
        end > minutes(b.start_time),
    )
  )
    return 'The provider is unavailable during that time';
  if (
    !excludeId &&
    provider.busy.some((b) => {
      const busyDate = String(b.appointment_date).slice(0, 10);
      const busyStart = minutes(String(b.appointment_time).slice(0, 5));
      const busyEnd = minutes(String(b.end_time).slice(0, 5));
      return busyDate === date && Number.isFinite(busyStart) && Number.isFinite(busyEnd) && start < busyEnd && end > busyStart;
    })
  )
    return 'That booking slot is already taken';
  if (
    appointments.some(
      (a) =>
        a.id !== excludeId &&
        a.provider_id === provider.id &&
        a.appointment_date === date &&
        occupiesSlot(a) &&
        start < minutes(a.appointment_time) + a.duration_minutes &&
        end > minutes(a.appointment_time),
    )
  )
    return 'That booking slot is already taken';
  return null;
}
export function providerTimes(provider: Provider, date: string) {
  const av = provider.availability.find((a) => a.day_of_week === dateOf(date).getDay());
  const duration = provider.default_duration_minutes;
  if (!av?.is_available || duration <= 0) return [];
  const result: string[] = [];
  for (let m = minutes(av.start_time); m + duration <= minutes(av.end_time); m += duration)
    result.push(timeString(m));
  return result;
}
