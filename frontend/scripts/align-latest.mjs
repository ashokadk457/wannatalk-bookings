import fs from 'node:fs';
const root = new URL('../', import.meta.url);
function edit(path, changes) { const file = new URL(path, root); let value = fs.readFileSync(file, 'utf8'); for (const [before, after] of changes) { if (!value.includes(before)) throw new Error(`Missing replacement in ${path}: ${before}`); value = value.replaceAll(before, after); } fs.writeFileSync(file, value); }
edit('src/features/profile/ProfilePage.tsx', [
  ["user?.preferredContact || 'WhatsApp'", "(['Email', 'SMS', 'Both'].includes(user?.preferredContact || '') ? user?.preferredContact : 'Email') || 'Email'"],
  ["mutate('/auth/me', 'PATCH'", "mutate(provider ? `/providers/${provider.id}/profile` : '/patients/me', 'PATCH'"],
  ["['WhatsApp', 'Phone', 'Email']", "['Email', 'SMS', 'Both']"],
]);
edit('src/features/appointments/AppointmentContext.tsx', [
  ["import { openWhatsApp, queueReminders, reminder }", "import { openWhatsApp, reminder }"],
  ["import { Field, StatusPill }", "import { MeetingLink } from '../../components/MeetingLink';\nimport { Field, StatusPill }"],
  ['</div>{editing ? <form', '</div><MeetingLink url={appointment.meeting_url} />{editing ? <form'],
  ['<button className="wa-btn" onClick={() => contact(appointment)}>WhatsApp</button>', "{user?.role !== 'patient' && <button className=\"btn secondary\" onClick={() => contact(appointment)}>Message patient</button>}"],
]);
edit('src/features/appointments/Calendar.tsx', [
  ['className="wa-btn small space-top"', 'className="btn secondary small space-top"'],
  ['>WhatsApp</button>', '>Message</button>'],
]);
edit('src/features/appointments/AppointmentTable.tsx', [
  ["import { Empty, StatusPill }", "import { MeetingLink } from '../../components/MeetingLink';\nimport { Empty, StatusPill }"],
  ['{a.intake_requested &&', '<MeetingLink url={a.meeting_url} />{a.intake_requested &&'],
  ["{user?.role !== 'admin' && <button className=\"wa-btn small space-top\"", "{user?.role !== 'patient' && <button className=\"btn secondary small space-top\""],
  ["{user?.role === 'patient' ? 'Contact' : 'WhatsApp'}", "Message"],
]);
edit('src/app/navigation.ts', [
  ["{ path: 'profile', label: 'My Profile'", "{ path: 'waiting', label: 'Cancellation list', icon: '◷' }, { path: 'profile', label: 'My Profile'"],
  ["{ path: 'messages', label: 'WhatsApp', icon: '◉' }", "{ path: 'followups', label: 'Follow-ups', icon: '✓' }, { path: 'messages', label: 'Messages', icon: '✉' }"],
  ["{ path: 'cancellations', label:", "{ path: 'providers', label: 'Providers', icon: '◉' }, { path: 'patients', label: 'Patients', icon: '◉' }, { path: 'cancellations', label:"],
  ["{ path: 'registrations', label:", "{ path: 'followups', label: 'Follow-ups', icon: '✓' }, { path: 'waiting', label: 'Waiting list', icon: '◷' }, { path: 'messages', label: 'Messages', icon: '✉' }, { path: 'health', label: 'System health', icon: '♥' }, { path: 'registrations', label:"],
]);
const workflow = fs.readFileSync(new URL('../../public/wannatalk-workflows.js', import.meta.url), 'utf8');
const css = [...workflow.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
fs.appendFileSync(new URL('src/styles/original.css', root), '\n' + css);
