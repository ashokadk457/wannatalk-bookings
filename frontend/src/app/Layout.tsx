import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from './AppContext';
import { homePath, navigation } from './navigation';
import { initials } from '../lib/dates';
import { mutate } from '../services/api';
import type { Role } from '../types';

const mobileNavigation: Record<Role, { path: string; label: string; icon: string }[]> = {
  patient: [
    { path: 'book', label: 'Book', icon: 'book' },
    { path: 'appointments', label: 'Bookings', icon: 'calendar' },
    { path: 'profile', label: 'Profile', icon: 'profile' },
  ],
  provider: [
    { path: 'dashboard', label: 'Home', icon: 'home' },
    { path: 'calendar', label: 'Calendar', icon: 'calendar' },
    { path: 'availability', label: 'Slots', icon: 'clock' },
    { path: 'patients', label: 'Patients', icon: 'patients' },
  ],
  admin: [
    { path: 'overview', label: 'Home', icon: 'home' },
    { path: 'registrations', label: 'Registrations', icon: 'register' },
    { path: 'availability', label: 'Slots', icon: 'clock' },
    { path: 'audit', label: 'Audit', icon: 'audit' },
  ],
};

function MobileIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="m4 11.5 8-6.5 8 6.5" />
        <path d="M6 10.5V19h12v-8.5" />
      </>
    ),
    book: (
      <>
        <path d="M5 4h11a3 3 0 0 1 3 3v13H7a2 2 0 0 1-2-2V4Z" />
        <path d="M8 9h8M12 6v6" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </>
    ),
    patients: (
      <>
        <circle cx="9" cy="9" r="3" />
        <path d="M4 19c.5-3.2 2.1-5 5-5s4.5 1.8 5 5M15 8.5a2.5 2.5 0 0 1 0 5M16 14.5c2.2.5 3.4 2 3.8 4.5" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.6-4.2 2.9-6.5 7-6.5s6.4 2.3 7 6.5" />
      </>
    ),
    register: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
    audit: (
      <>
        <path d="M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function Layout({ role }: { role: Role }) {
  const { user, data, logout, run, refresh } = useApp(),
    location = useLocation(),
    navigate = useNavigate();
  const [drawer, setDrawer] = useState(false),
    [busy, setBusy] = useState(false);
  const [pendingOnline, setPendingOnline] = useState<boolean | null>(null);
  useEffect(() => {
    setDrawer(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    document.body.classList.toggle('drawer-open', drawer);
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.classList.remove('drawer-open');
      document.removeEventListener('keydown', escape);
    };
  }, [drawer]);
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={homePath(user.role)} replace />;
  const current = navigation[role].find((item) => location.pathname.endsWith(`/${item.path}`));
  const provider = data.providers.find((p) => p.id === user.entityId);
  const mobileItems = mobileNavigation[role];
  const mobilePathIsPrimary = mobileItems.some((item) => item.path === current?.path);
  const dashboard = current?.path === 'dashboard' || current?.path === 'overview';
  const title = dashboard
    ? role === 'provider'
      ? `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${user.fullName.split(' ')[0]}`
      : 'Practice dashboard'
    : current?.label || 'WannaTalk';
  async function toggleOnline(online: boolean) {
    if (!provider) return;
    setPendingOnline(online);
    setBusy(true);
    await run(
      async () => {
        await mutate(`/providers/${provider.id}/status`, 'PATCH', { isOnline: online });
        await refresh();
      },
      `You are now ${online ? 'online' : 'offline'}`,
    );
    setBusy(false);
    setPendingOnline(null);
  }
  return (
    <div id={`${role}Shell`} className={`app ${drawer ? 'mobile-drawer-open' : ''}`}>
      <aside className="sidebar" id="app-navigation">
        <div className="brand">
          <img
            className="brand-logo"
            src="/assets/wannatalk-logo.png"
            alt="WannaTalk — You are not alone"
          />
        </div>
        <nav className="nav" aria-label={`${role} navigation`}>
          {navigation[role].map((item) => (
            <button
              key={item.path}
              aria-current={item === current ? 'page' : undefined}
              className={item === current ? 'active' : ''}
              onClick={() => navigate(`/${role}/${item.path}`)}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        {provider && (
          <label className="provider-status-toggle">
            <span>{provider.is_online ? '● Online' : '○ Offline'}</span>
            <input
              type="checkbox"
              aria-label="Provider online status"
              checked={pendingOnline ?? provider.is_online}
              disabled={busy}
              onChange={(e) => void toggleOnline(e.target.checked)}
            />
            <small>Patients can book while you are offline.</small>
          </label>
        )}
        <div className="provider-card">
          <div className="avatar">{initials(user.fullName)}</div>
          <div>
            <strong>{user.fullName}</strong>
            <span>
              {provider?.professional_title ||
                (role === 'admin' ? 'Administrator' : 'Patient account')}
            </span>
          </div>
        </div>
        <button
          className="btn secondary logout"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
        >
          Log out
        </button>
      </aside>
      <button
        className="mobile-drawer-backdrop"
        aria-label="Close navigation"
        tabIndex={drawer ? 0 : -1}
        onClick={() => setDrawer(false)}
      />
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu-btn"
            aria-label={drawer ? 'Close navigation' : 'Open navigation'}
            aria-expanded={drawer}
            aria-controls="app-navigation"
            onClick={() => setDrawer((v) => !v)}
          >
            <span />
          </button>
          <div>
            <h2>{title}</h2>
            <p>
              {role === 'patient'
                ? 'Choose a provider, date and available time.'
                : role === 'admin'
                  ? 'Appointments, registrations and provider presence across the practice.'
                  : 'Capture bookings, reminders and patient updates from one clear dashboard.'}
            </p>
          </div>
          <div className="top-actions">
            <span className="pill">
              {new Date().toLocaleDateString('en-ZA', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </header>
        <Outlet />
      </main>
      <nav className="mobile-app-nav" aria-label={`${role} mobile navigation`}>
        {mobileItems.map((item) => {
          const active = current?.path === item.path;
          return (
            <button
              type="button"
              key={item.path}
              className={active ? 'active' : ''}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              onClick={() => navigate(`/${role}/${item.path}`)}
            >
              <span className="m-icon">
                <MobileIcon name={item.icon} />
              </span>
              <span className="m-label">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`mobile-more-btn${!mobilePathIsPrimary || drawer ? ' active' : ''}`}
          aria-label={drawer ? 'Close menu' : 'Open menu'}
          aria-expanded={drawer}
          aria-controls="app-navigation"
          onClick={() => setDrawer((value) => !value)}
        >
          <span className="m-icon">
            <MobileIcon name="menu" />
          </span>
          <span className="m-label">Menu</span>
        </button>
      </nav>
    </div>
  );
}
