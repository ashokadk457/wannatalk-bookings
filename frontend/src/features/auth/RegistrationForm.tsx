import { useState, type FormEvent } from 'react';
import { Field, LocationFields } from '../../components/ui';
import { mutate } from '../../services/api';
import { useApp } from '../../app/AppContext';
import type { RegistrationInput, RegistrationResult, Role } from '../../types';
export default function RegistrationForm({ role, administrator = false, onComplete }: { role: Role; administrator?: boolean; onComplete?: (result: RegistrationResult, email: string) => void | Promise<void> }) {
  const { run, notify, refresh } = useApp();
  const initial: RegistrationInput = { role, fullName: '', email: '', mobile: '', password: '', preferredContact: 'Email', professionalTitle: '', durationMinutes: 60, bio: '', locations: [] };
  const [form, setForm] = useState(initial), [busy, setBusy] = useState(false);
  const set = <K extends keyof RegistrationInput>(key: K, value: RegistrationInput[K]) => setForm(previous => ({ ...previous, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (role === 'provider' && !form.locations.length) return notify('Choose at least one practice location');
    setBusy(true);
    await run(async () => {
      const result = await mutate<RegistrationResult>('/auth/register', 'POST', { ...form, role });
      setForm(initial);
      if (administrator) { await refresh(); notify(role === 'patient' ? 'Patient registered successfully' : 'Provider request created · approve it below'); }
      await onComplete?.(result, form.email);
    });
    setBusy(false);
  }
  return <form onSubmit={submit}><fieldset disabled={busy} className="form-reset"><div className="form-grid">
    <Field label="Full name"><input required maxLength={100} autoComplete="name" value={form.fullName} onChange={e => set('fullName', e.target.value)} /></Field>
    <Field label="Email"><input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
    <Field label="Mobile / SMS"><input maxLength={30} autoComplete="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)} /></Field>
    {role === 'patient' && <Field label="Preferred contact"><select value={form.preferredContact} onChange={e => set('preferredContact', e.target.value)}>{['Email', 'SMS', 'Both'].map(c => <option key={c}>{c}</option>)}</select></Field>}
    {role === 'provider' && <><Field label="Professional title"><input maxLength={100} placeholder="Counsellor / Psychologist" value={form.professionalTitle} onChange={e => set('professionalTitle', e.target.value)} /></Field><Field label="Session duration"><select value={form.durationMinutes} onChange={e => set('durationMinutes', Number(e.target.value))}>{[45, 60, 90].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></Field><LocationFields value={form.locations} onChange={v => set('locations', v)} /><Field label="Short bio" full><textarea maxLength={500} placeholder="Optional" value={form.bio} onChange={e => set('bio', e.target.value)} /></Field></>}
    <Field label={administrator ? 'Temporary password' : 'Password'} full><input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={form.password} onChange={e => set('password', e.target.value)} /><span className="sub">Use at least 12 characters.</span></Field>
    <div className="notice field full">{role === 'patient' ? 'Verify your contact details to activate your account. Accounts created by an administrator require MFA at login.' : 'Verify your contact details. An existing administrator must approve this account before login.'}</div>
  </div><button className="btn space-top" type="submit">{busy ? 'Submitting…' : administrator ? `Register ${role === 'patient' ? 'client' : 'provider'}` : 'Create account'}</button></fieldset></form>;
}
