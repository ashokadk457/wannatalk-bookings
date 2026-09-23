import type { Page } from '@playwright/test';
import type { Role } from '../../types';
export const appointmentDate = '2027-01-04';
export async function mockApi(page: Page, role: Role, authenticated = true) {
  const requests: { path: string; method: string; body: Record<string, unknown> }[] = [], unexpected: string[] = [];
  const user = { id: `${role}-user`, fullName: `${role} Test`, email: `${role}@example.test`, mobile: '+27000000000', role, entityId: role === 'patient' ? 'patient-1' : role === 'provider' ? 'provider-1' : null, preferredContact: 'Email', isActive: true };
  const provider = { id: 'provider-1', full_name: 'Dr Test Provider', email: 'provider@example.test', mobile: '+27000000000', is_active: true, professional_title: 'Counsellor', default_duration_minutes: 60, bio: 'Counselling services', is_online: true, locations: ['Online', 'Centurion'] };
  const patient = { id: 'patient-1', full_name: 'Test Patient', email: 'patient@example.test', mobile: '+27000000000', preferred_contact: 'Email', is_active: true };
  const appointment = { id: 'appointment-1', provider_id: provider.id, patient_id: patient.id, location_id: 'online', appointment_date: appointmentDate, appointment_time: '10:00', duration_minutes: 60, appointment_type: 'Individual counselling', mode: 'Online', status: 'Booked', payment_status: 'Unpaid', note: '<img src=x onerror="window.__unsafe=true">', intake_requested: true, patient_name: patient.full_name, patient_email: patient.email, patient_mobile: patient.mobile, provider_name: provider.full_name, provider_email: provider.email, provider_mobile: provider.mobile, professional_title: provider.professional_title, location_name: 'Online', meeting_url: 'https://example.test/session' };
  let appointments = [appointment, { ...appointment, id: 'cancelled-1', status: 'Cancelled', appointment_time: '11:00' }];
  let followUps: Record<string, unknown>[] = [{ id: 'follow-1', patient_name: patient.full_name, provider_name: provider.full_name, due_at: `${appointmentDate}T10:00:00Z`, internal_note: 'Private note', reminder_message: 'Public reminder', reminder_channels: ['email'], reminder_sent_at: null, status: 'open' }];
  let entries: Record<string, unknown>[] = [{ id: 'wait-1', patient_name: patient.full_name, provider_name: provider.full_name, location_name: 'Online', date_from: appointmentDate, date_to: '2027-01-10', time_preference: 'any', notification_channels: ['email'], status: 'active', notification_count: 0 }];
  let deliveries: Record<string, unknown>[] = [];
  let registrations = [{ id: 'registration-1', full_name: 'New Provider', email: 'new@example.test', role: 'provider', mobile: '', created_at: '2026-09-23T00:00:00Z', locations: ['Online'] }];
  await page.addInitScript(({ authenticated, token }) => { if (authenticated && !sessionStorage.getItem('initialized')) { localStorage.setItem('wannatalkApiToken', token); sessionStorage.setItem('initialized', 'yes'); } }, { authenticated, token: `${role}-token` });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.slice(4), method = request.method(), body = request.postDataJSON() || {};
    requests.push({ path, method, body });
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === '/auth/me') return json({ user });
    if (path === '/auth/login' || path === '/auth/register') return json({ status: 'verification_required', mfaRequired: true, verificationRequired: true, purpose: path.endsWith('register') ? 'registration' : 'login', challengeId: 'challenge-1', methods: [{ method: 'email', label: 'Email', destination: 'te**@example.test' }] });
    if (path === '/auth/mfa/send') return json({ message: 'Verification code sent by email', destination: 'te**@example.test', expiresMinutes: 10 });
    if (path === '/auth/mfa/verify') return body.code === '123456' ? json({ status: 'approved', token: `${role}-token`, user }) : json({ error: 'Incorrect verification code' }, 400);
    if (path === '/auth/forgot-password') return json({ message: 'If an active account exists, a reset link has been sent.' });
    if (path === '/auth/reset-password') return json({ message: 'Password updated successfully', email: user.email, role });
    if (path === '/providers') return json({ providers: [provider] });
    if (path === '/providers/provider-1/availability') return method === 'GET' ? json({ availability: Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, is_available: i >= 1 && i <= 5, start_time: '09:00', end_time: '17:00' })), blocks: [{ id: 'block-1', block_date: appointmentDate, start_time: '12:00', end_time: '13:00', reason: 'Unavailable' }], busy: appointments.filter(a => a.status !== 'Cancelled').map(a => ({ appointment_date: a.appointment_date, appointment_time: a.appointment_time, end_time: '11:00' })) }) : json({ ok: true });
    if (path.startsWith('/providers/provider-1/') && method === 'PATCH') { if (path.endsWith('/status')) provider.is_online = Boolean(body.isOnline); if (path.endsWith('/deactivate')) provider.is_active = false; if (path.endsWith('/reactivate')) provider.is_active = true; if (body.fullName) provider.full_name = String(body.fullName); return json({ provider }); }
    if (path === '/patients' && method === 'GET') return json({ patients: [patient] });
    if (path.startsWith('/patients/') && method === 'PATCH') { if (body.fullName) { patient.full_name = String(body.fullName); if (role === 'patient') user.fullName = patient.full_name; } if (path.endsWith('/deactivate')) patient.is_active = false; if (path.endsWith('/reactivate')) patient.is_active = true; return json({ patient }); }
    if (path === '/locations') return json({ locations: [{ id: 'online', name: 'Online' }, { id: 'centurion', name: 'Centurion' }] });
    if (path === '/appointments' && method === 'GET') return json({ appointments });
    if (path === '/appointments' && method === 'POST') { const a = { ...appointment, id: `new-${appointments.length}`, appointment_date: String(body.appointmentDate), appointment_time: String(body.appointmentTime) }; appointments.push(a); return json({ appointment: a }, 201); }
    if (path.startsWith('/appointments/') && method === 'PATCH') { const a = appointments.find(a => a.id === path.split('/')[2]); if (a) { if (body.status) a.status = String(body.status); if (body.appointmentDate) a.appointment_date = String(body.appointmentDate); if (body.appointmentTime) a.appointment_time = String(body.appointmentTime); } return json({ appointment: a }); }
    if (path.startsWith('/appointments/') && method === 'DELETE') { appointments = appointments.filter(a => a.id !== path.split('/')[2]); return route.fulfill({ status: 204 }); }
    if (path === '/registrations') return json({ registrations });
    if (path.startsWith('/registrations/')) { registrations = []; return json({ ok: true }); }
    if (path === '/audit-logs') return json({ auditLogs: [{ id: 'audit-1', user_name: 'Admin', user_role: 'admin', action: 'Created booking', location_name: 'Online', appointment_id: 'appointment-1', details: {}, created_at: '2026-09-23T00:00:00Z' }] });
    if (path === '/follow-ups' && method === 'GET') return json({ followUps });
    if (path === '/follow-ups' && method === 'POST') { followUps.push({ id: 'follow-2', patient_name: patient.full_name, provider_name: provider.full_name, due_at: body.dueAt, internal_note: body.internalNote, reminder_channels: body.reminderChannels, status: 'open' }); return json({ followUp: followUps.at(-1) }); }
    if (path.startsWith('/follow-ups/')) { if (path.endsWith('/status')) followUps = followUps.map(f => f.id === path.split('/')[2] ? { ...f, status: body.status } : f); return json({ deliveries: [{ status: 'sent' }] }); }
    if (path === '/communications') return json({ deliveries });
    if (path === '/communications/send') { deliveries.push({ id: 'delivery-1', patient_name: patient.full_name, provider_name: provider.full_name, channel: 'email', recipient: patient.email, subject: body.subject, message_text: body.message, status: 'sent', created_at: '2026-09-23T00:00:00Z' }); return json({ deliveries: [{ status: 'sent' }] }); }
    if (path === '/waiting-list' && method === 'GET') return json({ entries });
    if (path === '/waiting-list' && method === 'POST') { entries.push({ ...entries[0], id: 'wait-2' }); return json({ entry: entries.at(-1) }); }
    if (path.startsWith('/waiting-list/matches/')) return json({ matches: entries });
    if (path.startsWith('/waiting-list/')) { if (path.endsWith('/cancel')) entries = entries.map(w => w.id === path.split('/')[2] ? { ...w, status: 'cancelled' } : w); return json({ deliveries: [{ status: 'sent' }] }); }
    if (path === '/admin/health') return json({ checkedAt: '2026-09-23T00:00:00Z', api: { ok: true, service: 'test-api', uptimeSeconds: 60, nodeVersion: '24', environment: 'test' }, database: { ok: true, responseMs: 2, database_name: 'test', active_accounts: 3, upcoming_appointments: 2 }, email: { configured: true, ok: true }, sms: { configured: true, ok: true } });
    unexpected.push(`${method} ${path}`); return json({ error: `Unexpected API: ${path}` }, 404);
  });
  page.on('dialog', dialog => void dialog.accept());
  return { requests, unexpected };
}
