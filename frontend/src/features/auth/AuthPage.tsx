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
        preferredMethod: result.preferredMethod,
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
      <div className="card auth-card wt-shell">
        <aside className="auth-brand wt-hero">
          <div>
            <div className="brand wt-brand">
              <img
                className="brand-logo"
                src="/assets/logo.svg"
                alt="WannaTalk — You are not alone"
                style={{ height: "70px", width: "70px" }}
              />
              <div className="wt-brand-name">
                Wanna<span>Talk</span>
              </div>
            </div>
            <div className="wt-tagline">You are not alone.</div>
          </div>
          <div className="wt-hero-copy">
            <h2>Care starts with the right connection.</h2>
            <p>
              Book sessions, complete intake, and stay connected with your care team in one place.
            </p>
          </div>
        </aside>
        <section className="auth-panel wt-content">
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
              <h1 className="wt-title">How would you like to continue?</h1>
              <p className="wt-intro">
                Patients can book available sessions or start with an intake. Providers can manage
                bookings, calendars, and availability.
              </p>
              <div className="wt-role-grid">
                <button
                  type="button"
                  className="wt-role-card featured"
                  onClick={() => choose('patient')}
                >
                  <span className="wt-role-body">
                    <span className="wt-role-top">
                      <span className="wt-icon" aria-hidden="true">
                        <svg viewBox="0 0 32 32" fill="none">
                          <path
                            d="M16 16.5a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
                            stroke="currentColor"
                            strokeWidth="2.4"
                          />
                          <path
                            d="M6 28c1.5-5.3 5.1-8.2 10-8.2S24.5 22.7 26 28"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <span className="wt-role-heading">
                        {/* Keeps the existing accessible name ("👤 Patient") announced by screen
                            readers and used by the Playwright specs. */}
                        <span className="wt-role-name">
                          <span className="visually-hidden">👤 </span>
                          Patient
                        </span>
                        <span className="wt-badge">Most common</span>
                      </span>
                    </span>
                    <span className="wt-role-copy">
                      Book a session, manage appointments, or continue your intake.
                    </span>
                  </span>
                  <span className="wt-card-action">Continue as patient →</span>
                </button>
                <button type="button" className="wt-role-card" onClick={() => choose('provider')}>
                  <span className="wt-role-body">
                    <span className="wt-role-top">
                      <span className="wt-icon" aria-hidden="true">
                        <svg viewBox="0 0 32 32" fill="none">
                          <path
                            d="M11 6v6M21 6v6"
                            stroke="currentColor"
                            strokeWidth="2.3"
                            strokeLinecap="round"
                          />
                          <path
                            d="M8 10h16a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z"
                            stroke="currentColor"
                            strokeWidth="2.3"
                          />
                          <path
                            d="M10 17h12M10 22h7"
                            stroke="currentColor"
                            strokeWidth="2.3"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <span className="wt-role-heading">
                        <span className="wt-role-name">
                          <span className="visually-hidden">🩺 </span>
                          Provider
                        </span>
                      </span>
                    </span>
                    <span className="wt-role-copy">
                      Manage bookings, availability, and patient communication.
                    </span>
                  </span>
                  <span className="wt-card-action">Continue as provider →</span>
                </button>
              </div>
              <section className="wt-intake-card" aria-label="Start intake">
                <div>
                  <h2>Not sure where to start?</h2>
                  <p>
                    Complete a guided intake first so our team can understand your needs before your
                    first session.
                  </p>
                </div>
                <button className="wt-primary-button" type="button" onClick={() => {window.open('https://intake.wannatalk.co.za/','_blank')}}>
                  Begin Intake →
                </button>
              </section>
              <div className="wt-footer">
                <span className="wt-powered">
                  <span className="wt-powered-mark" aria-hidden="true">
                    ✓
                  </span>
                  Powered by <strong>WannaTalk</strong>
                </span>
                <button type="button" className="wt-admin" onClick={() => choose('admin')}>
                  Admin access
                </button>
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
        <div className="wt-copyright">
          <small>Copyright WannaTalk™ 2026</small>
        </div>
      </div>
    </div>
  );
}
