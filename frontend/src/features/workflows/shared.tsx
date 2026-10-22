import { useEffect, useId, useMemo, useState } from 'react';
import { useApp } from '../../app/AppContext';
import { Field } from '../../components/ui';
import { mutate } from '../../services/api';
export function Channels({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="field full location-fields">
      <legend>Delivery channels</legend>
      <div className="workflow-checks">
        {['email', 'sms', 'whatsapp'].map((channel) => (
          <label key={channel}>
            <input
              type="checkbox"
              checked={value.includes(channel)}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...value, channel] : value.filter((c) => c !== channel),
                )
              }
            />
            {channel === 'sms'
              ? 'SMS'
              : channel === 'email'
                ? 'Email'
                : channel === 'whatsapp'
                  ? 'WhatsApp'
                  : ''}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function PatientSelect({
  value,
  onChange,
  allowCreate = false,
}: {
  value: string;
  onChange: (id: string) => void;
  allowCreate?: boolean;
}) {
  const { data, refresh, notify } = useApp();
  const inputId = useId();
  const patients = useMemo(
    () => data.patients.filter((patient) => patient.is_active !== false),
    [data.patients],
  );
  const selected = patients.find((patient) => patient.id === value);
  const patientLabel = (patient: (typeof patients)[number]) =>
    `${patient.full_name} · ${patient.email}`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newPatient, setNewPatient] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    preferredContact: 'Email',
  });
  useEffect(() => {
    if (selected) setQuery(patientLabel(selected));
    else if (!value) setQuery('');
  }, [selected?.id, value]);
  const matches = patients
    .filter((patient) => patientLabel(patient).toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20);
  async function createPatient() {
    if (!newPatient.fullName.trim() || !newPatient.email.trim() || newPatient.password.length < 8) {
      notify(
        'Enter the patient name, a valid email and a temporary password of at least 8 characters',
      );
      return;
    }
    setBusy(true);
    try {
      const result = await mutate<{ patient: { id: string } }>('/patients', 'POST', newPatient);
      await refresh();
      onChange(result.patient.id);
      setQuery(`${newPatient.fullName.trim()} · ${newPatient.email.trim().toLowerCase()}`);
      setCreating(false);
      notify('Patient created and selected');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to create patient');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="field searchable-patient-field">
      <label htmlFor={inputId}>Patient</label>
      <div className="searchable-select">
        <input
          id={inputId}
          required
          type="search"
          autoComplete="off"
          placeholder="Search or choose a patient"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange('');
            setOpen(true);
          }}
          aria-expanded={open}
          aria-controls={`${inputId}-options`}
        />
        {open && (
          <div className="searchable-select-options" id={`${inputId}-options`} role="listbox">
            {matches.length ? (
              matches.map((patient) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={patient.id === value}
                  key={patient.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(patient.id);
                    setQuery(patientLabel(patient));
                    setOpen(false);
                  }}
                >
                  <strong>{patient.full_name}</strong>
                  <span>{patient.email}</span>
                </button>
              ))
            ) : (
              <span className="searchable-select-empty">No matching patients</span>
            )}
          </div>
        )}
      </div>
      {allowCreate && !creating && (
        <button
          type="button"
          className="link-button patient-create-toggle"
          onClick={() => setCreating(true)}
        >
          ＋ Create new patient
        </button>
      )}
      {allowCreate && creating && (
        <div className="inline-patient-create">
          <strong>Create patient</strong>
          <input
            aria-label="New patient full name"
            placeholder="Full name"
            value={newPatient.fullName}
            onChange={(event) =>
              setNewPatient((current) => ({ ...current, fullName: event.target.value }))
            }
          />
          <input
            aria-label="New patient email"
            type="email"
            placeholder="Email"
            value={newPatient.email}
            onChange={(event) =>
              setNewPatient((current) => ({ ...current, email: event.target.value }))
            }
          />
          <input
            aria-label="New patient mobile"
            placeholder="Mobile (optional)"
            value={newPatient.mobile}
            onChange={(event) =>
              setNewPatient((current) => ({ ...current, mobile: event.target.value }))
            }
          />
          <input
            aria-label="New patient temporary password"
            type="password"
            minLength={8}
            maxLength={128}
            placeholder="Temporary password (minimum 8)"
            value={newPatient.password}
            onChange={(event) =>
              setNewPatient((current) => ({ ...current, password: event.target.value }))
            }
          />
          <select
            aria-label="New patient preferred contact"
            value={newPatient.preferredContact}
            onChange={(event) =>
              setNewPatient((current) => ({ ...current, preferredContact: event.target.value }))
            }
          >
            <option>Email</option>
            <option>SMS</option>
            <option>Both</option>
          </select>
          <div className="actions">
            <button
              type="button"
              className="btn small"
              disabled={busy}
              onClick={() => void createPatient()}
            >
              {busy ? 'Creating…' : 'Create and select'}
            </button>
            <button
              type="button"
              className="btn secondary small"
              disabled={busy}
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export function ProviderSelect({
  value,
  onChange,
  optional = false,
  disabled = false,
}: {
  value: string;
  onChange: (id: string) => void;
  optional?: boolean;
  disabled?: boolean;
}) {
  const { data } = useApp();
  return (
    <Field label="Provider">
      <select
        required={!optional}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{optional ? 'Any / practice administration' : 'Choose provider'}</option>
        {data.providers
          .filter((p) => p.is_active)
          .map((p) => (
            <option value={p.id} key={p.id}>
              {p.full_name}
            </option>
          ))}
      </select>
    </Field>
  );
}
export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  return error ? (
    <div className="notice" role="alert">
      {error}{' '}
      <button className="btn secondary" onClick={retry}>
        Retry
      </button>
    </div>
  ) : loading ? (
    <p role="status">Loading…</p>
  ) : null;
}
export function deliverySummary(
  deliveries: { channel?: string; status: string; error_message?: string | null }[],
) {
  const sent = deliveries.filter((delivery) => delivery.status === 'sent').length;
  const failed = deliveries.filter((delivery) => delivery.status !== 'sent');
  const counts = `Follow-up: ${sent} success, ${failed.length} failed`;
  const reasons = [...new Set(failed.map((delivery) => delivery.error_message).filter(Boolean))];
  return reasons.length ? `${counts} (${reasons.join('; ')})` : counts;
}
