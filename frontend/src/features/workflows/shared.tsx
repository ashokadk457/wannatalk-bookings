import { useApp } from '../../app/AppContext';
import { Field } from '../../components/ui';
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
        {['email', 'sms'].map((channel) => (
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
            {channel === 'sms' ? 'SMS' : 'Email'}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function PatientSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data } = useApp();
  return (
    <Field label="Patient">
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose patient</option>
        {data.patients
          .filter((p) => p.is_active !== false)
          .map((p) => (
            <option value={p.id} key={p.id}>
              {p.full_name} · {p.email}
            </option>
          ))}
      </select>
    </Field>
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
export function deliverySummary(deliveries: { status: string }[]) {
  const sent = deliveries.filter((d) => d.status === 'sent').length;
  return `${sent} delivered · ${deliveries.length - sent} failed`;
}
