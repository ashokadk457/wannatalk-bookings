import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Field, Heading, LocationFields } from '../../components/ui';
import { mutate } from '../../services/api';
export default function ProfilePage() {
  const { user, data, run, refresh, notify } = useApp();
  const provider = data.providers.find((p) => p.id === user?.entityId);
  const [name, setName] = useState(user?.fullName || ''),
    [mobile, setMobile] = useState(user?.mobile || ''),
    [contact, setContact] = useState(
      (['Email', 'SMS', 'Both'].includes(user?.preferredContact || '')
        ? user?.preferredContact
        : 'Email') || 'Email',
    );
  const [title, setTitle] = useState(provider?.professional_title || ''),
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
        fullName: name,
        mobile,
        preferredContact: contact,
        professionalTitle: title,
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
              <Field label={provider ? 'Display name' : 'Name'}>
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Email">
                <input type="email" disabled value={user?.email || ''} />
              </Field>
              <Field label="Mobile">
                <input maxLength={30} value={mobile} onChange={(e) => setMobile(e.target.value)} />
              </Field>
              {provider ? (
                <>
                  <Field label="Professional title">
                    <input
                      maxLength={100}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
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
