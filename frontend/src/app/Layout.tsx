import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from './AppContext';
import { homePath, navigation } from './navigation';
import { initials } from '../lib/dates';
import { mutate } from '../services/api';
import type { Role } from '../types';
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
    </div>
  );
}
