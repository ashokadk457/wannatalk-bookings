import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Field, Heading, LocationFields } from '../../components/ui';
import { mutate } from '../../services/api';
import { doctorCategories, doctorSubCategories } from '../../data/doctorCategories';
export default function ProfilePage() {
  const { user, data, run, refresh, notify } = useApp();
  const provider = data.providers.find((p) => p.id === user?.entityId);
  const [name, setName] = useState(user?.fullName || ''),
    [firstName, setFirstName] = useState(provider ? (user?.fullName || '').trim().split(/\s+/)[0] || '' : ''),
    [lastName, setLastName] = useState(provider ? (user?.fullName || '').trim().split(/\s+/).slice(1).join(' ') : ''),
    [mobile, setMobile] = useState(user?.mobile || ''),
    [contact, setContact] = useState(
      (['Email', 'SMS', 'Both'].includes(user?.preferredContact || '')
        ? user?.preferredContact
        : 'Email') || 'Email',
    );
  const [title, setTitle] = useState(provider?.professional_title || ''),
    [providerTitle, setProviderTitle] = useState(provider?.title || ''),
    [specialty, setSpecialty] = useState(provider?.specialty || ''),
    [subSpecialties, setSubSpecialties] = useState(provider?.sub_specialties || []),
    [medicalRegistrationNumber, setMedicalRegistrationNumber] = useState(provider?.medical_registration_number || ''),
    [practiceNumber, setPracticeNumber] = useState(provider?.practice_number || ''),
    [practiceSetting, setPracticeSetting] = useState(provider?.practice_setting || ''),
    [privatePracticeName, setPrivatePracticeName] = useState(provider?.private_practice_name || ''),
    [duration, setDuration] = useState(provider?.default_duration_minutes || 60),
    [bio, setBio] = useState(provider?.bio || ''),
    [locations, setLocations] = useState(provider?.locations || []),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (provider && !locations.length) return notify('Choose at least one practice location');
    setBusy(true);
    await run(async () => {
      await mutate(provider ? `/providers/${provider.id}/profile` : '/patients/me', 'PATCH', {
        fullName: provider ? `${firstName.trim()} ${lastName.trim()}`.trim() : name,
        mobile,
        preferredContact: contact,
        professionalTitle: title,
        title: providerTitle,
        specialty,
        subSpecialties,
        medicalRegistrationNumber,
        practiceNumber,
        practiceSetting,
        privatePracticeName,
        durationMinutes: duration,
        bio,
        locations,
      });
      await refresh();
    }, 'Profile saved');
    setBusy(false);
  }
  return (
    <section>
      <Heading
        title={provider ? 'Provider profile' : 'My profile'}
        subtitle={
          provider
            ? 'Details patients see when choosing a provider.'
            : 'Your contact details used for bookings.'
        }
      />
      <Card>
        <form onSubmit={submit}>
          <fieldset className="form-reset" disabled={busy}>
            <div className="form-grid">
              {provider ? <>
                <Field label="Title"><select required value={providerTitle} onChange={(e) => setProviderTitle(e.target.value)}><option value="">Select title</option>{['Dr.','Prof.','Mr.','Ms.'].map((v) => <option key={v}>{v}</option>)}</select></Field>
                <Field label="First Name"><input required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
                <Field label="Last Name"><input required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
              </> : <Field label="Name"><input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></Field>}
              <Field label="Email">
                <input type="email" disabled value={user?.email || ''} />
              </Field>
              <Field label="Mobile">
                <input maxLength={30} value={mobile} onChange={(e) => setMobile(e.target.value)} />
              </Field>
              {provider ? (
                <>
                  <Field label="Specialty (Optional)"><select value={specialty} onChange={(e) => { setSpecialty(e.target.value); setSubSpecialties([]); }}><option value="">Select specialty</option>{doctorCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                  <Field label="Sub Specialty (Optional)"><div className="specialty-picker"><div className="specialty-options">{doctorSubCategories.filter((s) => s.categoryId === specialty).map((s) => <label className={`specialty-option ${subSpecialties.includes(s.id) ? 'selected' : ''}`} key={s.id}><input type="checkbox" checked={subSpecialties.includes(s.id)} onChange={() => setSubSpecialties(subSpecialties.includes(s.id) ? subSpecialties.filter((id) => id !== s.id) : [...subSpecialties, s.id])} /><span>{s.name}</span></label>)}</div></div></Field>
                  <Field label="Medical Registration Number (Optional)"><input value={medicalRegistrationNumber} onChange={(e) => setMedicalRegistrationNumber(e.target.value)} /></Field>
                  <Field label="Practice No (Optional)"><input value={practiceNumber} onChange={(e) => setPracticeNumber(e.target.value)} /></Field>
                  <Field label="Practice Setting (Optional)"><select value={practiceSetting} onChange={(e) => setPracticeSetting(e.target.value)}><option value="">Select setting</option>{['Private Practice','Hospital','Clinic','Community Health Centre','Academic / Teaching'].map((v) => <option key={v}>{v}</option>)}</select></Field>
                  <Field label="Private Practice Name (Optional)"><input value={privatePracticeName} onChange={(e) => setPrivatePracticeName(e.target.value)} /></Field>
                  <Field label="Professional title">
                    <input maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
                  </Field>
                  <Field label="Default session duration">
                    <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                      {[45, 60, 90].map((n) => (
                        <option key={n} value={n}>
                          {n} minutes
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Short bio / service note" full>
                    <textarea
                      maxLength={500}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </Field>
                  <LocationFields
                    value={locations}
                    onChange={setLocations}
                    locations={data.locations.map((l) => l.name)}
                  />
                </>
              ) : (
                <Field label="Preferred contact">
                  <select value={contact} onChange={(e) => setContact(e.target.value)}>
                    {['Email', 'SMS', 'Both'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            <button className="btn space-top">{busy ? 'Saving…' : 'Save profile'}</button>
          </fieldset>
        </form>
      </Card>
    </section>
  );
}
