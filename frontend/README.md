# WannaTalk React frontend

React + TypeScript + Vite migration of the **latest** `../public/index.html` and `../public/wannatalk-workflows.js`. The original frontend, Express backend, migrations, and Nginx configuration are unchanged. This directory is the new frontend source; `dist/` is its deployable build.

## Run locally

Use Node 22.12+ (or Node 24 LTS), pnpm, and the existing backend with its normal database and service configuration.

```sh
cd frontend
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to `http://127.0.0.1:3000`. If the backend runs on a different port, change `server.proxy` in `vite.config.ts`. The proxy is required for same-origin trusted-device cookies; do not point the frontend directly at another origin unless the backend's CORS/cookie configuration supports it.

An existing, configured backend is required for real login. No demo login or fake production data is bundled into the app. Browser tests use isolated mocked API responses, including MFA, and never send real email/SMS.

## Check and build

```sh
pnpm typecheck
pnpm test
pnpm build
# With the development server running in another terminal:
pnpm test:e2e
```

Browser tests use installed Google Chrome in headless mode. Change the Playwright `channel` if you prefer another installed browser. `TEST_BASE_URL` can point tests at a local production preview. The committed pnpm lockfile fixes dependency versions. `pnpm format` formats TypeScript, React components, and new CSS; the extracted original CSS is deliberately kept intact.

## Structure

- `src/app`: role-aware routing, navigation, session state, API-loaded data, layout.
- `src/features/auth`: login, registration, MFA, trusted-device option, forgot/reset password.
- `src/features/patient`, `provider`, `admin`: module-specific pages.
- `src/features/appointments`: shared calendars, bookable slots, booking details/actions.
- `src/features/workflows`: email/SMS delivery, follow-ups, cancellation lists.
- `src/components`: form fields, cards, modal, safe meeting links.
- `src/services/api.ts`: typed API client and session expiry handling.
- `src/styles/original.css`: original theme and dynamically injected styles extracted from both source files.
- `src/styles/app.css`: React layout/accessibility adjustments.
- `public/assets`: original brand images extracted from the HTML and source assets.
- `src/tests`: booking-rule tests and browser regression tests.

Pages are lazy-loaded. Add new pages as feature modules, register a route in `src/app/Router.tsx`, and add a navigation entry in `src/app/navigation.ts`. Do not put new page logic into `index.html`.

## Deployment (not performed)

Build, then deploy **all contents of `frontend/dist/`**, including `assets/`, to the Nginx web root. Copying only `index.html` will not work. Keep `/api/` proxied to the existing backend and keep the existing `try_files $uri $uri/ /index.html` fallback so refreshes and deep links work.

Retain the old web-root files in a rollback release before switching. Serve hashed JS/CSS assets with long-lived caching and `index.html` with no-cache/no-store. The build is static and does not require a Node server for the frontend.

Do not overwrite the original `public/index.html` with this source entry file: it references development TypeScript. Deploy the built `dist/` output instead.

## Limits of verification

The migration uses the existing API contracts without backend changes. A production build and browser tests do not certify the deployed database, SMTP/SMS delivery, MFA credentials, trusted-device cookie policies, or external meeting/intake services. Verify these with test accounts in staging before switching the live site. Authentication still uses the existing JWT localStorage contract; this migration is not a replacement security audit.
