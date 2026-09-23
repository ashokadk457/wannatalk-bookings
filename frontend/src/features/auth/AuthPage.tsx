import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Field } from '../../components/ui';
import { homePath } from '../../app/navigation';
import { mutate } from '../../services/api';
import type { MfaChallenge, RegistrationResult, Role } from '../../types';
import RegistrationForm from './RegistrationForm';
import MfaForm from './MfaForm';
export default function AuthPage() {
  const { user, login, acceptSession, notify, run, logout } = useApp(),
    location = useLocation();
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get('reset') || '',
  );
  const [role, setRole] = useState<Role | null>(null),
    [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirmPassword, setConfirmPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  useEffect(() => {
    if (resetToken) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      logout();
    }
  }, []);
  if (user && !resetToken) {
    const from = (location.state as { from?: string } | null)?.from;
    return (
      <Navigate to={from?.startsWith(`/${user.role}/`) ? from : homePath(user.role)} replace />
    );
  }
  async function handleResult(result: RegistrationResult) {
    if (result.challengeId && result.methods)
      setChallenge({
        challengeId: result.challengeId,
        methods: result.methods,
        purpose: result.purpose || 'registration',
        unavailableMethods: result.unavailableMethods,
      });
    else if (result.token && result.user) await acceptSession(result.token, result.user);
    else {
      setMode('login');
      notify(result.message || 'Registration submitted for administrator approval');
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setBusy(true);
    await run(async () => {
      const result = await login(email.trim(), password, role);
      setPassword('');
      if (result.mfaRequired || result.verificationRequired) await handleResult(result);
    });
    setBusy(false);
  }
  async function forgot(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await run(async () => {
      const result = await mutate<{ message: string }>('/auth/forgot-password', 'POST', { email });
      notify(result.message);
      setMode('login');
    });
    setBusy(false);
  }
  async function reset(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) return notify('Passwords do not match');
    setBusy(true);
    await run(async () => {
      const result = await mutate<{ message: string; email: string; role: Role }>(
        '/auth/reset-password',
        'POST',
        { token: resetToken, password, confirmPassword },
      );
      setResetToken('');
      setPassword('');
      setConfirmPassword('');
      setRole(result.role);
      setEmail(result.email);
      setMode('login');
      notify(result.message);
    });
    setBusy(false);
  }
  function choose(next: Role) {
    setRole(next);
    setMode('login');
    setPassword('');
  }
  return (
    <div id="auth" className="auth-wrap">
      <div className="card auth-card">
        <section
          className="auth-brand"
          style={{
            backgroundImage:
              'linear-gradient(180deg,rgba(4,18,36,.16),rgba(4,18,36,.7)),url(/assets/welcome.jpg)',
          }}
        >
          <div>
            <div className="brand">
              <img
                className="brand-logo"
                src="/assets/logo-transparent.png"
                alt="WannaTalk — You are not alone"
              />
            </div>
            <h2 style={{ fontSize: 34, marginTop: 40 }}>
              One booking system.
              <br />
              Simple, connected care.
            </h2>
            <p style={{ opacity: 0.8, lineHeight: 1.7 }}>
              Patients book available sessions while providers manage their calendars and
              communication in one place.
            </p>
          </div>
          <small>Copyright WannaTalk™ 2026</small>
        </section>
        <section className="auth-panel">
          {resetToken ? (
            <form onSubmit={reset}>
              <h2>Create new password</h2>
              <p className="sub">Enter the new password twice to confirm it.</p>
              <Field label="New password">
                <input
                  required
                  autoComplete="new-password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <div className="space-top">
                <Field label="Confirm new password">
                  <input
                    required
                    autoComplete="new-password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </Field>
              </div>
              <button disabled={busy} className="btn full-width space-top">
                Update password
              </button>
              <button
                type="button"
                className="btn secondary space-top"
                onClick={() => {
                  setResetToken('');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                Cancel
              </button>
            </form>
          ) : challenge ? (
            <MfaForm
              challenge={challenge}
              onCancel={() => setChallenge(null)}
              onPending={(message) => {
                setChallenge(null);
                setMode('login');
                notify(message);
              }}
            />
          ) : !role ? (
            <>
              <h2>Welcome</h2>
              <p className="sub">Choose how you want to enter the system.</p>
              <div className="rolechoice">
                <button className="rolecard" onClick={() => choose('patient')}>
                  <h3>👤 Patient</h3>
                  <span className="sub">Book and manage sessions.</span>
                </button>
                <button className="rolecard" onClick={() => choose('provider')}>
                  <h3>🩺 Provider</h3>
                  <span className="sub">Manage bookings and availability.</span>
                </button>
              </div>
              <div className="admin-access">
                <button onClick={() => choose('admin')}>Administration access</button>
              </div>
            </>
          ) : (
            <>
              <button className="btn secondary" onClick={() => setRole(null)}>
                ← Back
              </button>
              <h2 id="authHeading" style={{ marginTop: 22 }}>
                {role === 'admin' ? 'Administrator' : role === 'provider' ? 'Provider' : 'Patient'}{' '}
                access
              </h2>
              {mode !== 'forgot' && (
                <div className="tabs">
                  <button
                    className={`tab ${mode === 'login' ? 'active' : ''}`}
                    onClick={() => setMode('login')}
                  >
                    Login
                  </button>
                  {role !== 'admin' && (
                    <button
                      className={`tab ${mode === 'register' ? 'active' : ''}`}
                      onClick={() => setMode('register')}
                    >
                      Register
                    </button>
                  )}
                </div>
              )}
              {mode === 'login' && (
                <form onSubmit={submit}>
                  <Field label="Email">
                    <input
                      required
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <div className="space-top">
                    <Field label="Password">
                      <input
                        required
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </Field>
                  </div>
                  <button className="btn full-width space-top" disabled={busy}>
                    {busy ? 'Signing in…' : 'Login'}
                  </button>
                  <button
                    type="button"
                    className="btn secondary full-width space-top"
                    onClick={() => setMode('forgot')}
                  >
                    Forgot password?
                  </button>
                  <div className="demo">Use the secure account password supplied by WannaTalk.</div>
                </form>
              )}
              {mode === 'register' && role !== 'admin' && (
                <RegistrationForm
                  key={role}
                  role={role}
                  onComplete={async (result, address) => {
                    setEmail(address);
                    await handleResult(result);
                  }}
                />
              )}
              {mode === 'forgot' && (
                <form onSubmit={forgot}>
                  <h3>Reset your password</h3>
                  <p className="sub">Enter the email address used for your WannaTalk account.</p>
                  <Field label="Email">
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <button disabled={busy} className="btn full-width space-top">
                    {busy ? 'Sending…' : 'Send reset link'}
                  </button>
                  <button
                    type="button"
                    className="btn secondary full-width space-top"
                    onClick={() => setMode('login')}
                  >
                    Back to login
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
