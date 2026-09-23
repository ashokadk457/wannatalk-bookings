# React migration

Source of truth: `C:/Jacob/wannatalk-bookings/public/index.html` and `public/wannatalk-workflows.js`.

The original frontend and backend are preserved. The React application is in this directory and has not been deployed.

The latest source includes MFA, password reset, provider time blocks, online meeting links, admin patient/provider management, system health, email/SMS communications, follow-ups, and cancellation waiting lists. These are part of the migration scope.

## Page inventory

| Module | Routes |
| --- | --- |
| Patient (4) | `/patient/book`, `/patient/appointments`, `/patient/waiting`, `/patient/profile` |
| Provider (7) | `/provider/dashboard`, `/provider/calendar`, `/provider/availability`, `/provider/patients`, `/provider/followups`, `/provider/messages`, `/provider/profile` |
| Admin (12) | `/admin/overview`, `/admin/appointments`, `/admin/providers`, `/admin/patients`, `/admin/cancellations`, `/admin/availability`, `/admin/followups`, `/admin/waiting`, `/admin/messages`, `/admin/health`, `/admin/registrations`, `/admin/audit` |
| Authentication | `/login` (role choice, login, registration, email/SMS MFA, trusted-device choice, forgot password); existing `#reset=...` links and `/reset-password` |

## Preserved behavior

- Existing role checks, JWT storage key, `/auth/me` restoration, MFA challenge/send/verify and password reset endpoints.
- Provider/admin approval, contact verification, inactive accounts, and profile edits use the current API.
- Green theme, logos, welcome background, responsive sidebar/drawer, forms, status pills and calendar grids.
- Day/week/month calendars, available-slot generation from provider duration and hours, past-time restrictions, booked/blocked slots, offline-but-bookable providers.
- Booking creation by patients and admins; view, reschedule, cancel, admin status changes/delete; optional intake and online meeting links.
- Admin account search/edit/activation, pending registrations, availability directory, system health, audit logs, appointment filtering/sorting.
- Private follow-up notes, separate patient reminder text, email/SMS composition and delivery history, cancellation-list membership/matching/notifications.

## Intentional implementation changes

- React renders user content as text; no legacy inline scripts, event-handler strings, `innerHTML`, or iframe wrapper is used.
- Stable database IDs replace temporary numeric IDs assigned by array position.
- Screens have shareable URLs, browser back/forward support, role guards and lazy-loaded code.
- Rescheduling uses a labelled dialog instead of browser prompt boxes.
- Forms have explicit accessible labels; modals use native dialog focus behavior.
- Month-end navigation clamps dates; local date formatting avoids UTC day shifts.
- All bookable providers remain selectable; day view exposes slots beyond the compact month preview.
- Legacy WhatsApp draft storage is not imported: the latest source replaced that UI with server-backed Email/SMS workflows.

No backend endpoints, database schema, production accounts, or live deployment were modified.

## Validation

- Strict TypeScript check and production Vite build.
- Eight booking/date rule tests (local date, month boundary, provider duration, offline availability, overlaps, blocked times, reschedule exclusion, inactive/past restrictions).
- Eighteen headless Chrome browser scenarios covering all 23 routes, reload/navigation, role guards, login/MFA errors and success, registration verification, pending-provider approval, password reset, booking creation/reschedule/cancellation/status/deletion, profile/availability saves, account activation, expired sessions, safe booking-note rendering, meeting links, messaging, follow-ups, waiting-list workflows and mobile navigation.
- Desktop/mobile screenshots inspected for layout. Tests use mocked API responses; they are not live delivery or database integration tests.
