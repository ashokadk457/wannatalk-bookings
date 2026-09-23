import type { Role } from '../types';
export const navigation: Record<Role, { path: string; label: string; icon: string }[]> = {
  patient: [
    { path: 'book', label: 'Book Session', icon: '＋' },
    { path: 'appointments', label: 'My Appointments', icon: '▦' },
    { path: 'waiting', label: 'Cancellation list', icon: '◷' },
    { path: 'profile', label: 'My Profile', icon: '◉' },
  ],
  provider: [
    { path: 'dashboard', label: 'Dashboard', icon: '▣' },
    { path: 'calendar', label: 'Calendar', icon: '▦' },
    { path: 'availability', label: 'Availability', icon: '◷' },
    { path: 'patients', label: 'Patients', icon: '◉' },
    { path: 'followups', label: 'Follow-ups', icon: '✓' },
    { path: 'messages', label: 'Messages', icon: '✉' },
    { path: 'profile', label: 'Provider Profile', icon: '⚙' },
  ],
  admin: [
    { path: 'overview', label: 'Admin overview', icon: '▣' },
    { path: 'appointments', label: 'Appointments', icon: '▦' },
    { path: 'providers', label: 'Providers', icon: '◉' },
    { path: 'patients', label: 'Patients', icon: '◉' },
    { path: 'cancellations', label: 'Cancellations', icon: '!' },
    { path: 'availability', label: 'Provider availability', icon: '◷' },
    { path: 'followups', label: 'Follow-ups', icon: '✓' },
    { path: 'waiting', label: 'Waiting list', icon: '◷' },
    { path: 'messages', label: 'Messages', icon: '✉' },
    { path: 'health', label: 'System health', icon: '♥' },
    { path: 'registrations', label: 'Registrations', icon: '＋' },
    { path: 'audit', label: 'Audit Log', icon: '▤' },
  ],
};
export const homePath = (role: Role) => `/${role}/${navigation[role][0].path}`;
