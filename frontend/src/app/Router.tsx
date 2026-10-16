import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './AppContext';
import Layout from './Layout';
import { homePath } from './navigation';
import SplashScreen from '../components/SplashScreen';
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
const WhatsAppTest = lazy(() => import('../features/admin/WhatsAppTestPage'));
const Messages = lazy(() => import('../features/workflows/MessagesPage'));
const AppointmentMessages = lazy(() => import('../features/workflows/AppointmentMessagesPage'));
const AutomaticReminders = lazy(() => import('../features/provider/AutomaticRemindersPage'));
const CancellationPolicy = lazy(() => import('../features/provider/CancellationPolicyPage'));
const FollowUps = lazy(() => import('../features/workflows/FollowUpsPage'));
const Waiting = lazy(() => import('../features/workflows/WaitingPage'));
const ProviderBillingProfiles = lazy(() => import('../features/billing/ProviderBillingProfilesPage'));
const BillingCompanies = lazy(() => import('../features/billing/CompaniesPage'));
const BillingInvoices = lazy(() => import('../features/billing/InvoicesPage'));
const BillingOverview = lazy(() => import('../features/billing/BillingOverviewPage'));
const BillingStatements = lazy(() => import('../features/billing/StatementsPage'));
const BillingPayments = lazy(() => import('../features/billing/PaymentsPage'));
const BillingAudit = lazy(() => import('../features/billing/BillingAuditPage'));
export default function Router() {
  const { user, loading, error, retry, logout } = useApp(),
    location = useLocation();
  const reset = new URLSearchParams(location.hash.slice(1)).has('reset');
  if (reset)
    return (
      <Suspense fallback={<p>Loading…</p>}>
        <Auth />
      </Suspense>
    );
  if (loading) return <SplashScreen />;
  if (error)
    return (
      <div className="loading-screen">
        <div className="card">
          <p role="alert">Unable to load your account: {error}</p>
          <button className="btn" onClick={retry}>
            Retry
          </button>{' '}
          <button className="btn secondary" onClick={logout}>
            Back to login
          </button>
        </div>
      </div>
    );
  return (
    <Suspense
      fallback={
        <SplashScreen />
      }
    >
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/reset-password" element={<Auth />} />
        <Route path="/patient" element={<Layout role="patient" />}>
          <Route path="cancellation-policy/:providerId" element={<CancellationPolicy readOnly />} />
          <Route index element={<Navigate to="book" replace />} />
          <Route path="book" element={<Book />} />
          <Route path="appointments" element={<PatientAppointments />} />
          <Route path="waiting" element={<Waiting />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="/provider" element={<Layout role="provider" />}>
          <Route path="cancellation-policy" element={<CancellationPolicy />} />
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="automatic-reminders" element={<AutomaticReminders />} />
          <Route path="availability" element={<Availability />} />
          <Route path="patients" element={<Directory />} />
          <Route path="followups" element={<FollowUps />} />
          <Route path="messages" element={<Messages />} />
          <Route path="appointment-messages" element={<AppointmentMessages />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="/admin" element={<Layout role="admin" />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Dashboard />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="cancellations" element={<Appointments cancellations />} />
          <Route path="availability" element={<AdminAvailability />} />
          <Route path="patients" element={<Directory />} />
          <Route path="providers" element={<Directory providers />} />
          <Route path="billing" element={<Navigate to="overview" replace />} />
          <Route path="billing/overview" element={<BillingOverview />} />
          <Route path="billing/providers" element={<ProviderBillingProfiles />} />
          <Route path="billing/companies" element={<BillingCompanies />} />
          <Route path="billing/invoices" element={<BillingInvoices />} />
          <Route path="billing/statements" element={<BillingStatements />} />
          <Route path="billing/payments" element={<BillingPayments />} />
          <Route path="billing/audit" element={<BillingAudit />} />
          <Route path="registrations" element={<Registrations />} />
          <Route path="audit" element={<Audit />} />
          <Route path="health" element={<Health />} />
          <Route path="whatsapp-test" element={<WhatsAppTest />} />
          <Route path="messages" element={<Messages />} />
          <Route path="appointment-messages" element={<AppointmentMessages />} />
          <Route path="followups" element={<FollowUps />} />
          <Route path="waiting" element={<Waiting />} />
        </Route>
        <Route path="/" element={<Navigate to={user ? homePath(user.role) : '/login'} replace />} />
        <Route
          path="*"
          element={
            <div className="loading-screen">
              <div className="card">
                <h2>Page not found</h2>
                <a className="btn" href={user ? homePath(user.role) : '/login'}>
                  Return to WannaTalk
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}
