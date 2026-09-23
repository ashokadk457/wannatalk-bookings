import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './AppContext';
import Layout from './Layout';
import { homePath } from './navigation';
const Auth = lazy(() => import('../features/auth/AuthPage'));
const Book = lazy(() => import('../features/patient/BookPage'));
const PatientAppointments = lazy(() => import('../features/patient/AppointmentsPage'));
const Profile = lazy(() => import('../features/profile/ProfilePage'));
const Dashboard = lazy(() => import('../features/dashboard/DashboardPage'));
const Calendar = lazy(() => import('../features/provider/CalendarPage'));
const Availability = lazy(() => import('../features/provider/AvailabilityPage'));
const AdminAvailability = lazy(() => import('../features/admin/AvailabilityPage'));
const Directory = lazy(() => import('../features/admin/DirectoryPage'));
const Appointments = lazy(() => import('../features/admin/AppointmentsPage'));
const Registrations = lazy(() => import('../features/admin/RegistrationsPage'));
const Audit = lazy(() => import('../features/admin/AuditPage'));
const Health = lazy(() => import('../features/admin/HealthPage'));
const Messages = lazy(() => import('../features/workflows/MessagesPage'));
const FollowUps = lazy(() => import('../features/workflows/FollowUpsPage'));
const Waiting = lazy(() => import('../features/workflows/WaitingPage'));
export default function Router() {
  const { user, loading, error, retry, logout } = useApp(), location = useLocation();
  const reset = new URLSearchParams(location.hash.slice(1)).has('reset');
  if (reset) return <Suspense fallback={<p>Loading…</p>}><Auth /></Suspense>;
  if (loading) return <div className="loading-screen" role="status">Loading WannaTalk…</div>;
  if (error) return <div className="loading-screen"><div className="card"><p role="alert">Unable to load your account: {error}</p><button className="btn" onClick={retry}>Retry</button> <button className="btn secondary" onClick={logout}>Back to login</button></div></div>;
  return <Suspense fallback={<div className="loading-screen" role="status">Loading page…</div>}><Routes><Route path="/login" element={<Auth />} /><Route path="/reset-password" element={<Auth />} /><Route path="/patient" element={<Layout role="patient" />}><Route index element={<Navigate to="book" replace />} /><Route path="book" element={<Book />} /><Route path="appointments" element={<PatientAppointments />} /><Route path="waiting" element={<Waiting />} /><Route path="profile" element={<Profile />} /></Route><Route path="/provider" element={<Layout role="provider" />}><Route index element={<Navigate to="dashboard" replace />} /><Route path="dashboard" element={<Dashboard />} /><Route path="calendar" element={<Calendar />} /><Route path="availability" element={<Availability />} /><Route path="patients" element={<Directory />} /><Route path="followups" element={<FollowUps />} /><Route path="messages" element={<Messages />} /><Route path="profile" element={<Profile />} /></Route><Route path="/admin" element={<Layout role="admin" />}><Route index element={<Navigate to="overview" replace />} /><Route path="overview" element={<Dashboard />} /><Route path="appointments" element={<Appointments />} /><Route path="cancellations" element={<Appointments cancellations />} /><Route path="availability" element={<AdminAvailability />} /><Route path="patients" element={<Directory />} /><Route path="providers" element={<Directory providers />} /><Route path="registrations" element={<Registrations />} /><Route path="audit" element={<Audit />} /><Route path="health" element={<Health />} /><Route path="messages" element={<Messages />} /><Route path="followups" element={<FollowUps />} /><Route path="waiting" element={<Waiting />} /></Route><Route path="/" element={<Navigate to={user ? homePath(user.role) : '/login'} replace />} /><Route path="*" element={<div className="loading-screen"><div className="card"><h2>Page not found</h2><a className="btn" href={user ? homePath(user.role) : '/login'}>Return to WannaTalk</a></div></div>} /></Routes></Suspense>;
}
