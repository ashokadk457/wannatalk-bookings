import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Field } from '../../components/ui';
import { homePath } from '../../app/navigation';
import { mutate } from '../../services/api';
import type { MfaChallenge, RegistrationResult, Role } from '../../types';
import RegistrationForm from './RegistrationForm';
import MfaForm from './MfaForm';

/* Social / channel links shown in the landing-page footer. Icons are inline SVG so no
   extra icon dependency is introduced, matching the rest of the app's icon approach. */
const socialChannels: { label: string; href: string; icon: ReactNode }[] = [
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@WannaTalk2026',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@wannatalk29',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/ansurie4j/',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
      </svg>
    ),
  },
  {
    label: 'WhatsApp',
    href: 'https://wa.me/27698984187',
    icon: (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4a10.6 10.6 0 1 1 9.3 5zm5.8-8c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.8.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-2-.8-3.4-1.8-4.5-3.8-.3-.5.3-.5.9-1.6.1-.2.1-.4 0-.6l-1-2.4c-.3-.6-.6-.5-.8-.5h-.7c-.2 0-.6.1-.9.4-1 1-1.4 2.2-1.4 3.6 0 2.1 1.5 4.1 1.7 4.4.2.3 3 4.7 7.4 6.4 2.7 1.1 3.8 1.2 5.1.9 1.2-.2 1.9-1 2.2-1.9.3-.9.3-1.6.2-1.8-.1-.2-.3-.3-.6-.5z" />
      </svg>
    ),
  },
];
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
                style={{ height: '70px', width: '70px' }}
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
                <button
                  className="wt-primary-button"
                  type="button"
                  onClick={() => {
                    window.open('https://intake.wannatalk.co.za/', '_blank');
                  }}
                >
                  Begin Intake →
                </button>
              </section>

              {/* Trust section - mobile responsive */}
              <section className="trust" aria-label="Professional affiliation and partnership">
                <a
                  className="trust-card"
                  href="https://www.psyssa.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="PsySSA Affiliate Member (opens in new tab)"
                >
                  <img
                    src="/assets/PsySSA-Logo_Final-2-1.png"
                    alt="PsySSA Psychological Society of South Africa logo"
                    loading="lazy"
                  />
                  <div>
                    <div className="trust-label">Affiliate Member</div>
                    <div className="trust-title">PsySSA</div>
                    <div className="trust-url">www.psyssa.com</div>
                  </div>
                </a>

                <a
                  className="trust-card partner"
                  href="https://louwalbertspsychologist.co.za"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="In partnership with Louw Alberts Psychology Practice (opens in new tab)"
                >
                  <img
                    src="/assets/file.jpg"
                    alt="Louw Alberts Psychology Practice logo"
                    loading="lazy"
                  />
                  <div>
                    <div className="trust-label">In partnership with</div>
                    <div className="trust-title">Louw Alberts Psychology Practice</div>
                    <div className="trust-url">louwalbertspsychologist.co.za</div>
                  </div>
                </a>
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
          <nav className="wt-social" aria-label="WannaTalk social channels">
            {socialChannels.map((channel) => (
              <a
                key={channel.label}
                href={channel.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${channel.label} (opens in a new tab)`}
              >
                {channel.icon}
                <span>{channel.label}</span>
              </a>
            ))}
          </nav>
          <small>Copyright WannaTalk™ 2026</small>
        </div>
      </div>
    </div>
  );
}
