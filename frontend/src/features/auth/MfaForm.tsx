import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Field } from '../../components/ui';
import { mutate } from '../../services/api';
import type { MfaChallenge, RegistrationResult } from '../../types';
export default function MfaForm({
  challenge,
  onCancel,
  onPending,
}: {
  challenge: MfaChallenge;
  onCancel: () => void;
  onPending: (message: string) => void;
}) {
  const { run, notify, acceptSession } = useApp();
  const [delivery, setDelivery] = useState(''),
    [code, setCode] = useState(''),
    [trust, setTrust] = useState(false),
    [busy, setBusy] = useState(false);
  async function send(method: string) {
    setBusy(true);
    await run(async () => {
      const result = await mutate<{ message: string; destination: string; expiresMinutes: number }>(
        '/auth/mfa/send',
        'POST',
        { challengeId: challenge.challengeId, method },
      );
      setDelivery(
        `${result.message} to ${result.destination}. The code expires in ${result.expiresMinutes} minutes.`,
      );
    });
    setBusy(false);
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await run(async () => {
      const result = await mutate<RegistrationResult>('/auth/mfa/verify', 'POST', {
        challengeId: challenge.challengeId,
        code,
        trustDevice: trust,
      });
      if (result.token && result.user) await acceptSession(result.token, result.user);
      else if (result.status === 'pending')
        onPending(result.message || 'Contact verified · awaiting administrator approval');
      else notify('Verification did not complete. Please try again.');
    });
    setBusy(false);
  }
  return (
    <div>
      <h3>Security verification</h3>
      {!delivery ? (
        <>
          <p className="sub">Choose where to receive your one-time verification code.</p>
          <div className="quick-list">
            {challenge.methods.map((method) => (
              <button
                disabled={busy}
                key={method.method}
                className="btn secondary"
                onClick={() => void send(method.method)}
              >
                Send by {method.label}
                <small className="sub block">{method.destination}</small>
              </button>
            ))}
            {challenge.unavailableMethods?.map((method) => (
              <button key={method.label} className="btn secondary" disabled>
                {method.label} unavailable<small className="sub block">{method.reason}</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <form onSubmit={verify}>
          <div role="status" className="notice">
            {delivery}
          </div>
          <Field label="Verification code">
            <input
              autoFocus
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,8}"
              minLength={6}
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <label className="check-row space-top">
            <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
            Trust this device for 14 days
          </label>
          <button disabled={busy} className="btn full-width space-top">
            {busy ? 'Verifying…' : 'Verify and continue'}
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn secondary full-width space-top"
            onClick={() => {
              setDelivery('');
              setCode('');
            }}
          >
            Send another code
          </button>
        </form>
      )}
      <button disabled={busy} className="btn secondary full-width space-top" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
