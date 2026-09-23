import { describe, expect, it, vi, afterEach } from 'vitest';
import { addMonths, isoDate, providerTimes, slotProblem } from '../lib/dates';
import type { Appointment, Provider } from '../types';
const provider: Provider = { id: 'provider-1', full_name: 'Dr Test', email: 'provider@example.test', mobile: '', is_active: true, professional_title: 'Counsellor', default_duration_minutes: 60, bio: '', is_online: false, locations: ['Online'], blocks: [], busy: [], availability: [{ day_of_week: 1, is_available: true, start_time: '09:00', end_time: '12:00' }] };
afterEach(() => vi.useRealTimers());
describe('Booking rules', () => {
  it('uses the local calendar date instead of converting it to UTC', () => { expect(isoDate(new Date(2027, 0, 2, 0, 30))).toBe('2027-01-02'); });
  it('clamps month navigation at the last valid day', () => { expect(addMonths('2027-01-31', 1)).toBe('2027-02-28'); });
  it('generates duration-aligned times from provider hours', () => { expect(providerTimes(provider, '2027-01-04')).toEqual(['09:00', '10:00', '11:00']); });
  it('does not make an offline provider unavailable', () => { vi.setSystemTime(new Date('2027-01-01T10:00:00')); expect(slotProblem(provider, '2027-01-04', '10:00', [])).toBeNull(); });
  it('blocks overlapping reservations with different start times', () => { vi.setSystemTime(new Date('2027-01-01T10:00:00')); const p = { ...provider, busy: [{ appointment_date: '2027-01-04', appointment_time: '09:30', end_time: '10:30' }] }; expect(slotProblem(p, '2027-01-04', '10:00', [])).toContain('taken'); expect(slotProblem(p, '2027-01-04', '11:00', [])).toBeNull(); });
  it('respects provider time blocks', () => { vi.setSystemTime(new Date('2027-01-01T10:00:00')); const p = { ...provider, blocks: [{ id: 'b', block_date: '2027-01-04', start_time: '10:00', end_time: '11:00', reason: 'Private' }] }; expect(slotProblem(p, '2027-01-04', '10:00', [])).toContain('unavailable'); });
  it('excludes the booking being rescheduled from conflict detection', () => { vi.setSystemTime(new Date('2027-01-01T10:00:00')); const a = { id: 'a', provider_id: provider.id, appointment_date: '2027-01-04', appointment_time: '10:00', duration_minutes: 60, status: 'Booked' } as Appointment; expect(slotProblem(provider, '2027-01-04', '10:00', [a], 'a')).toBeNull(); });
  it('rejects past times and inactive providers', () => { vi.setSystemTime(new Date('2027-01-04T10:00:00')); expect(slotProblem(provider, '2027-01-04', '09:00', [])).toContain('Past'); expect(slotProblem({ ...provider, is_active: false }, '2027-01-04', '11:00', [])).toContain('inactive'); });
});
