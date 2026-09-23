import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Field, LocationFields } from '../../components/ui';
import LegalModal from '../../components/LegalModal';
import { mutate } from '../../services/api';
import { useApp } from '../../app/AppContext';
import type { RegistrationInput, RegistrationResult, Role } from '../../types';
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
    nationality: 'South Africa',
    otpMethod: 'email',
    patientConsentAccepted: false,
    termsAccepted: false,
    privacyAccepted: false,
    professionalTitle: '',
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
          role === 'patient' ? `${form.firstName.trim()} ${form.lastName.trim()}` : form.fullName,
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
            ) : (
              <Field label="Full name">
                <input
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                />
              </Field>
            )}
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
                    onChange={(e) => set('identityDocument', e.target.value)}
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
                    {[
                      'South Africa',
                      'Botswana',
                      'Eswatini',
                      'Lesotho',
                      'Malawi',
                      'Mozambique',
                      'Namibia',
                      'Zambia',
                      'Zimbabwe',
                      'Other',
                    ].map((nationality) => (
                      <option key={nationality}>{nationality}</option>
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
                {!administrator && (
                  <fieldset className="otp-choice field full">
                    <legend>Choose how you'd like to authenticate via OTP</legend>
                    <label>
                      <input
                        type="radio"
                        name="otpMethod"
                        value="email"
                        checked={form.otpMethod === 'email'}
                        onChange={() => set('otpMethod', 'email')}
                      />
                      Send code via email
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="otpMethod"
                        value="sms"
                        checked={form.otpMethod === 'sms'}
                        onChange={() => set('otpMethod', 'sms')}
                      />
                      Send code via phone no.
                    </label>
                  </fieldset>
                )}
              </>
            )}
            {role === 'provider' && (
              <>
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
