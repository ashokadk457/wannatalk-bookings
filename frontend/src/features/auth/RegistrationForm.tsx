import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Field, LocationFields } from '../../components/ui';
import LegalModal from '../../components/LegalModal';
import { mutate } from '../../services/api';
import { useApp } from '../../app/AppContext';
import type { RegistrationInput, RegistrationResult, Role } from '../../types';
import { countries } from '../../data/countries';
import { doctorCategories, doctorSubCategories } from '../../data/doctorCategories';
type LegalAcceptance = 'consent';
const LEGAL_DOCUMENT_HREF = {
  patient: '/legal/patient-consent.html',
  provider: '/legal/provider-consent.html',
} as const;
const LEGAL_DOCUMENT = { field: 'patientConsentAccepted' as const, title: 'Consent document' };
export default function RegistrationForm({
  role,
  administrator = false,
  onComplete,
}: {
  role: Role;
  administrator?: boolean;
  onComplete?: (result: RegistrationResult, email: string) => void | Promise<void>;
}) {
  const { run, notify, refresh } = useApp();
  const initial: RegistrationInput = {
    role,
    fullName: '',
    title: '',
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    password: '',
    preferredContact: 'Email',
    identityDocument: '',
    dateOfBirth: '',
    nationality: 'ZA',
    otpMethod: 'email',
    patientConsentAccepted: false,
    termsAccepted: false,
    privacyAccepted: false,
    professionalTitle: '',
    specialty: '',
    subSpecialties: [],
    medicalRegistrationNumber: '',
    practiceNumber: '',
    practiceSetting: '',
    privatePracticeName: '',
    durationMinutes: 60,
    bio: '',
    locations: [],
  };
  const [form, setForm] = useState(initial),
    [busy, setBusy] = useState(false);
  const [activeLegalModal, setActiveLegalModal] = useState<LegalAcceptance | null>(null);
  const legalTriggerRef = useRef<HTMLInputElement | null>(null);
  const set = <K extends keyof RegistrationInput>(key: K, value: RegistrationInput[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  function extractSouthAfricanIdDob(idNumber: string) {
    if (!/^\d{13}$/.test(idNumber)) return null;
    const yy = Number(idNumber.slice(0, 2));
    const mm = Number(idNumber.slice(2, 4));
    const dd = Number(idNumber.slice(4, 6));
    const currentYear = new Date().getFullYear() % 100;
    const fullYear = yy <= currentYear ? 2000 + yy : 1900 + yy;
    const date = new Date(fullYear, mm - 1, dd);
    if (date.getFullYear() !== fullYear || date.getMonth() !== mm - 1 || date.getDate() !== dd)
      return null;
    return `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  function updateIdentityDocument(value: string) {
    const next = { identityDocument: value } as Partial<RegistrationInput>;
    if (/^\d{13}$/.test(value)) next.dateOfBirth = extractSouthAfricanIdDob(value) || '';
    setForm((previous) => ({ ...previous, ...next }));
  }
  function handleLegalCheckbox(_key: LegalAcceptance, event: ChangeEvent<HTMLInputElement>) {
    if (event.target.checked) {
      // The checkbox stays controlled by form state, so skipping set() keeps it
      // unchecked; the modal acceptance sets the value instead.
      legalTriggerRef.current = event.currentTarget;
      setActiveLegalModal(_key);
    } else set(LEGAL_DOCUMENT.field, false);
  }
  function closeLegalModal() {
    setActiveLegalModal(null);
    legalTriggerRef.current?.focus();
  }
  function acceptLegalModal() {
    setForm((previous) => ({
      ...previous,
      patientConsentAccepted: true,
      termsAccepted: true,
      privacyAccepted: true,
    }));
    closeLegalModal();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (role === 'provider' && !form.locations.length)
      return notify('Choose at least one practice location');
    if (/^\d{13}$/.test(form.identityDocument) && !extractSouthAfricanIdDob(form.identityDocument))
      return notify('Enter a valid South African ID number or use a passport number');
    if (!administrator) {
      if (!form.patientConsentAccepted) {
        setActiveLegalModal('consent');
        return;
      }
    }
    setBusy(true);
    await run(async () => {
      const result = await mutate<RegistrationResult>('/auth/register', 'POST', {
        ...form,
        role,
        fullName:
          `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      });
      setForm(initial);
      if (administrator) {
        await refresh();
        notify(
          role === 'patient'
            ? 'Patient registered successfully'
            : 'Provider request created · approve it below',
        );
      }
      await onComplete?.(result, form.email);
    });
    setBusy(false);
  }
  return (
    <>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="form-reset">
          <div className="form-grid">
            {role === 'patient' ? (
              <>
                <Field label="Title">
                  <select
                    required
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                  >
                    <option value="">Select title</option>
                    {['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', 'Prof.', 'Mx.'].map((title) => (
                      <option key={title}>{title}</option>
                    ))}
                  </select>
                </Field>
                <Field label="First Name">
                  <input
                    required
                    maxLength={50}
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                  />
                </Field>
                <Field label="Last Name">
                  <input
                    required
                    maxLength={50}
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                  />
                </Field>
              </>
            ) : null}
            <Field label="Email">
              <input
                required
                type="email"
                maxLength={254}
                autoComplete="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Phone No. / Mobile">
              <input
                required={role === 'patient'}
                maxLength={30}
                autoComplete="tel"
                inputMode="tel"
                pattern="\+?[0-9][0-9 ()-]{7,28}"
                title="Enter a valid phone number, for example +27 82 123 4567"
                value={form.mobile}
                onChange={(e) => set('mobile', e.target.value)}
              />
            </Field>
            {role === 'patient' && (
              <>
                <Field label="South African ID / Passport No.">
                  <input
                    required
                    minLength={5}
                    maxLength={30}
                    autoComplete="off"
                    value={form.identityDocument}
                    onChange={(e) => updateIdentityDocument(e.target.value.replace(/\s/g, ''))}
                    pattern="(?:\d{13}|[A-Za-z0-9][A-Za-z0-9 -]{4,29})"
                    title="Enter a valid 13-digit South African ID number or passport number"
                  />
                </Field>
                <Field label="Date of Birth">
                  <input
                    required
                    type="date"
                    min="1900-01-01"
                    max={new Date().toISOString().slice(0, 10)}
                    value={form.dateOfBirth}
                    onChange={(e) => set('dateOfBirth', e.target.value)}
                  />
                </Field>
                <Field label="Nationality">
                  <select
                    required
                    value={form.nationality}
                    onChange={(e) => set('nationality', e.target.value)}
                  >
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Preferred Contact">
                  <select
                    value={form.preferredContact}
                    onChange={(e) => set('preferredContact', e.target.value)}
                  >
                    {['Email', 'SMS', 'Both'].map((contact) => (
                      <option key={contact}>{contact}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {role === 'provider' && (
              <>
                <Field label="Title">
                  <select required value={form.title} onChange={(e) => set('title', e.target.value)}>
                    <option value="">Select title</option><option>Dr.</option><option>Prof.</option><option>Mr.</option><option>Ms.</option>
                  </select>
                </Field>
                <Field label="First Name"><input required autoComplete="given-name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
                <Field label="Last Name"><input required autoComplete="family-name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
                <Field label="Specialty (Optional)"><select value={form.specialty} onChange={(e) => { set('specialty', e.target.value); set('subSpecialties', []); }}><option value="">Select specialty</option>{doctorCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Sub Specialty (Optional)">
                  <div className="specialty-picker">
                    {!form.specialty ? <span className="sub">Select a specialty first.</span> : (
                      <div className="specialty-options">
                        {doctorSubCategories.filter((s) => s.categoryId === form.specialty).map((s) => {
                          const checked = form.subSpecialties.includes(s.id);
                          return <label className={`specialty-option ${checked ? 'selected' : ''}`} key={s.id}>
                            <input type="checkbox" checked={checked} onChange={() => set('subSpecialties', checked ? form.subSpecialties.filter((id) => id !== s.id) : [...form.subSpecialties, s.id])} />
                            <span>{s.name}</span>
                          </label>;
                        })}
                      </div>
                    )}
                    {form.subSpecialties.length > 0 && <div className="selected-specialties">{form.subSpecialties.map((id) => <span className="specialty-chip" key={id}>{doctorSubCategories.find((s) => s.id === id)?.name}<button type="button" aria-label={`Remove ${doctorSubCategories.find((s) => s.id === id)?.name}`} onClick={() => set('subSpecialties', form.subSpecialties.filter((value) => value !== id))}>×</button></span>)}</div>}
                  </div>
                </Field>
                <Field label="Medical Registration Number (Optional)"><input maxLength={80} value={form.medicalRegistrationNumber} onChange={(e) => set('medicalRegistrationNumber', e.target.value)} /></Field>
                <Field label="Practice No (Optional)"><input maxLength={80} value={form.practiceNumber} onChange={(e) => set('practiceNumber', e.target.value)} /></Field>
                <Field label="Practice Setting (Optional)"><select value={form.practiceSetting} onChange={(e) => set('practiceSetting', e.target.value)}><option value="">Select setting</option><option>Private Practice</option><option>Hospital</option><option>Clinic</option><option>Community Health Centre</option><option>Academic / Teaching</option></select></Field>
                <Field label="Private Practice Name (Optional)"><input maxLength={150} value={form.privatePracticeName} onChange={(e) => set('privatePracticeName', e.target.value)} /></Field>
                <Field label="Professional title">
                  <input
                    maxLength={100}
                    placeholder="Counsellor / Psychologist"
                    value={form.professionalTitle}
                    onChange={(e) => set('professionalTitle', e.target.value)}
                  />
                </Field>
                <Field label="Session duration">
                  <select
                    value={form.durationMinutes}
                    onChange={(e) => set('durationMinutes', Number(e.target.value))}
                  >
                    {[45, 60, 90].map((n) => (
                      <option key={n} value={n}>
                        {n} minutes
                      </option>
                    ))}
                  </select>
                </Field>
                <LocationFields value={form.locations} onChange={(v) => set('locations', v)} />
                <Field label="Short bio" full>
                  <textarea
                    maxLength={500}
                    placeholder="Optional"
                    value={form.bio}
                    onChange={(e) => set('bio', e.target.value)}
                  />
                </Field>
              </>
            )}
            <Field label={administrator ? 'Temporary password' : 'Password'} full>
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
              />
              <span className="sub">Use at least 12 characters.</span>
            </Field>
            {!administrator && (
              <fieldset className="otp-choice field full">
                <legend>Choose how you'd like to authenticate via OTP</legend>
                <label><input type="radio" name="otpMethod" value="email" checked={form.otpMethod === 'email'} onChange={() => set('otpMethod', 'email')} /> Send code via email</label>
                <label><input type="radio" name="otpMethod" value="sms" checked={form.otpMethod === 'sms'} onChange={() => set('otpMethod', 'sms')} /> Send code via phone no.</label>
              </fieldset>
            )}
            {!administrator && (
              <div className="legal-acceptance field full">
                <label>
                  <input required type="checkbox" checked={form.patientConsentAccepted} onChange={(event) => handleLegalCheckbox('consent', event)} />
                  {role === 'patient' ? 'I confirm that I have read, understood and accepted the ' : 'I agree to the '}
                  <a href='#' onClick={(event) => { event.preventDefault(); setActiveLegalModal('consent'); }}>
                    {role === 'patient' ? 'Patient Consent, Terms and Conditions and Privacy Policy' : 'Terms and Conditions'}
                  </a>.
                </label>
              </div>
            )}
            <div className="notice field full">
              {role === 'patient'
                ? administrator
                  ? 'The patient account is available immediately. MFA is required when the patient first logs in.'
                  : 'Your patient account is available after you verify the one-time code sent to your selected contact method.'
                : 'Verify your contact details. An existing administrator must approve this account before login.'}
            </div>
          </div>
          <button
            className="btn space-top"
            type="submit"
            disabled={!administrator && !form.patientConsentAccepted}
          >
            {busy
              ? 'Submitting…'
              : administrator
                ? `Register ${role === 'patient' ? 'client' : 'provider'}`
                : 'Create account'}
          </button>
        </fieldset>
      </form>
      {activeLegalModal && (
        <LegalModal
          key={activeLegalModal}
          title={role === 'patient' ? 'Patient Consent, Terms and Conditions and Privacy Policy' : 'Provider Terms and Conditions'}
          src={LEGAL_DOCUMENT_HREF[role === 'provider' ? 'provider' : 'patient']}
          accepted={form.patientConsentAccepted}
          onAccept={acceptLegalModal}
          onClose={closeLegalModal}
        />
      )}
    </>
  );
}
