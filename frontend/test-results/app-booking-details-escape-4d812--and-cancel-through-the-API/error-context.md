# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> booking details escape user text, show meeting link, and cancel through the API
- Location: src\tests\browser\app.spec.ts:22:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - img "WannaTalk — You are not alone" [ref=e6]
      - navigation "patient navigation" [ref=e7]:
        - button "＋ Book Session" [ref=e8] [cursor=pointer]
        - button "▦ My Appointments" [ref=e9] [cursor=pointer]
        - button "◷ Cancellation list" [ref=e10] [cursor=pointer]
        - button "◉ My Profile" [ref=e11] [cursor=pointer]
      - generic [ref=e12]:
        - generic [ref=e13]: PT
        - generic [ref=e14]:
          - strong [ref=e15]: patient Test
          - generic [ref=e16]: Patient account
      - button "Log out" [ref=e17] [cursor=pointer]
    - main [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]:
          - heading "My Appointments" [level=2] [ref=e21]
          - paragraph [ref=e22]: Choose a provider, date and available time.
        - generic [ref=e23]: Wed, 23 Sept 2026
      - generic [ref=e25]:
        - generic [ref=e27]:
          - heading "My appointments" [level=2] [ref=e28]
          - paragraph [ref=e29]: Upcoming and previous sessions.
        - generic [ref=e30]:
          - generic [ref=e31]:
            - generic [ref=e32]:
              - heading "Calendar view" [level=2] [ref=e33]
              - paragraph [ref=e34]: Appointments by day, week, or month.
            - generic [ref=e35]:
              - generic [ref=e36]: 21 Sept 2026 – 25 Sept 2026
              - button "‹ Month" [ref=e37] [cursor=pointer]
              - button "‹ Week" [ref=e38] [cursor=pointer]
              - button "Today" [ref=e39] [cursor=pointer]
              - button "Week ›" [ref=e40] [cursor=pointer]
              - button "Month ›" [ref=e41] [cursor=pointer]
          - paragraph [ref=e42]: 0 appointments showing
          - generic [ref=e44]:
            - generic [ref=e46]: Mon, 21 Sept
            - generic [ref=e47]: Tue, 22 Sept
            - generic [ref=e48]: Wed, 23 Sept
            - generic [ref=e49]: Thu, 24 Sept
            - generic [ref=e50]: Fri, 25 Sept
            - generic [ref=e51]: 09:00
            - generic [ref=e57]: 10:30
            - generic [ref=e63]: 12:00
            - generic [ref=e69]: 14:00
            - generic [ref=e75]: 15:30
            - generic [ref=e81]: 16:00
        - article [ref=e87]:
          - table [ref=e89]:
            - rowgroup [ref=e90]:
              - row [ref=e91]:
                - columnheader "Date" [ref=e92]
                - columnheader "Time" [ref=e93]
                - columnheader "Provider" [ref=e94]
                - columnheader "Type / location" [ref=e95]
                - columnheader "Status" [ref=e96]
                - columnheader "Actions" [ref=e97]
            - rowgroup [ref=e98]:
              - row [ref=e99]:
                - cell "04 Jan 2027" [ref=e100]
                - cell "11:00 60 min" [ref=e101]:
                  - strong [ref=e102]: 11:00
                  - generic [ref=e103]: 60 min
                - cell "Dr Test Provider Counsellor" [ref=e104]:
                  - generic [ref=e105]: Dr Test Provider
                  - generic [ref=e106]: Counsellor
                - cell "Individual counselling 📍 Online Online session link Join session https://example.test/session Intake selected" [ref=e107]:
                  - text: Individual counselling
                  - generic [ref=e108]: 📍 Online
                  - generic [ref=e109]:
                    - strong [ref=e110]: Online session link
                    - link "Join session" [ref=e111] [cursor=pointer]:
                      - /url: https://example.test/session
                    - generic [ref=e112]: https://example.test/session
                  - generic [ref=e113]: Intake selected
                - cell "Cancelled" [ref=e114]
                - cell [ref=e116]:
                  - button "View" [ref=e118] [cursor=pointer]
              - row [ref=e119]:
                - cell "04 Jan 2027" [ref=e120]
                - cell "10:00 60 min" [ref=e121]:
                  - strong [ref=e122]: 10:00
                  - generic [ref=e123]: 60 min
                - cell "Dr Test Provider Counsellor" [ref=e124]:
                  - generic [ref=e125]: Dr Test Provider
                  - generic [ref=e126]: Counsellor
                - cell "Individual counselling 📍 Online Online session link Join session https://example.test/session Intake selected" [ref=e127]:
                  - text: Individual counselling
                  - generic [ref=e128]: 📍 Online
                  - generic [ref=e129]:
                    - strong [ref=e130]: Online session link
                    - link "Join session" [ref=e131] [cursor=pointer]:
                      - /url: https://example.test/session
                    - generic [ref=e132]: https://example.test/session
                  - generic [ref=e133]: Intake selected
                - cell "Booked" [ref=e134]
                - cell [ref=e136]:
                  - generic [ref=e137]:
                    - button "View" [ref=e138] [cursor=pointer]
                    - button "Reschedule" [ref=e139] [cursor=pointer]
                    - button "Cancel" [ref=e140] [cursor=pointer]
  - dialog [ref=e141]:
    - generic [ref=e142]:
      - heading "Booking details" [level=3] [ref=e143]
      - button "Close" [active] [ref=e144] [cursor=pointer]
    - generic [ref=e145]:
      - generic [ref=e146]:
        - generic [ref=e147]: Patient
        - strong [ref=e148]: Test Patient
      - generic [ref=e149]:
        - generic [ref=e150]: Provider
        - strong [ref=e151]: Dr Test Provider
      - generic [ref=e152]:
        - generic [ref=e153]: Date
        - strong [ref=e154]: 04 Jan 2027
      - generic [ref=e155]:
        - generic [ref=e156]: Time
        - strong [ref=e157]: 11:00 – 12:00
      - generic [ref=e158]:
        - generic [ref=e159]: Type
        - strong [ref=e160]: Individual counselling
      - generic [ref=e161]:
        - generic [ref=e162]: Location / mode
        - strong [ref=e163]: Online
      - generic [ref=e164]:
        - generic [ref=e165]: Payment
        - strong [ref=e166]: Unpaid
      - generic [ref=e167]:
        - generic [ref=e168]: Status
        - generic [ref=e169]: Cancelled
      - generic [ref=e170]:
        - generic [ref=e171]: Note
        - strong [ref=e172]: <img src=x onerror="window.__unsafe=true">
      - generic [ref=e173]:
        - generic [ref=e174]: Intake
        - strong [ref=e175]: Optional intake selected
    - generic [ref=e176]:
      - strong [ref=e177]: Online session link
      - link "Join session" [ref=e178] [cursor=pointer]:
        - /url: https://example.test/session
      - generic [ref=e179]: https://example.test/session
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { mockApi } from './fixtures';
  3  | import { navigation } from '../../app/navigation';
  4  | import type { Role } from '../../types';
  5  | for (const role of ['patient', 'provider', 'admin'] as Role[]) {
  6  |   test(`${role}: all pages, reload, and sidebar links`, async ({ page }) => {
  7  |     const api = await mockApi(page, role), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  8  |     await page.goto(`/${role}/${navigation[role][0].path}`);
  9  |     for (const item of navigation[role]) { await page.getByRole('navigation').getByRole('button', { name: new RegExp(item.label) }).click(); await expect(page).toHaveURL(new RegExp(`/${role}/${item.path}$`)); await expect(page.locator('main')).toBeVisible(); await expect(page.getByText('Unable to display this page')).toHaveCount(0); }
  10 |     await page.reload(); await expect(page.getByRole('navigation')).toBeVisible(); expect(errors).toEqual([]); expect(api.unexpected).toEqual([]);
  11 |   });
  12 | }
  13 | test('MFA login rejects a bad code, verifies, and logs out', async ({ page }) => {
  14 |   await mockApi(page, 'patient', false); await page.goto('/login'); await page.getByRole('button', { name: '👤 Patient' }).click(); await page.getByLabel('Email', { exact: true }).fill('patient@example.test'); await page.getByLabel('Password', { exact: true }).fill('test-password-123'); await page.getByRole('button', { name: 'Login', exact: true }).last().click(); await page.getByRole('button', { name: /Send by Email/ }).click(); await page.getByLabel('Verification code').fill('111111'); await page.getByRole('button', { name: 'Verify and continue' }).click(); await expect(page.getByRole('status')).toHaveText('Incorrect verification code'); await page.getByLabel('Verification code').fill('123456'); await page.getByRole('button', { name: 'Verify and continue' }).click(); await expect(page).toHaveURL(/patient\/book/); await page.getByRole('button', { name: 'Log out' }).click(); await expect(page).toHaveURL(/login/); expect(await page.evaluate(() => localStorage.getItem('wannatalkApiToken'))).toBeNull();
  15 | });
  16 | test('registration continues through contact verification', async ({ page }) => { const api = await mockApi(page, 'patient', false); await page.goto('/login'); await page.getByRole('button', { name: '👤 Patient' }).click(); await page.getByRole('button', { name: 'Register', exact: true }).click(); await page.getByLabel('Full name').fill('New Patient'); await page.getByLabel('Email', { exact: true }).fill('new@example.test'); await page.getByLabel('Password', { exact: true }).fill('test-password-123'); await page.getByRole('button', { name: 'Create account' }).click(); await expect(page.getByRole('heading', { name: 'Security verification' })).toBeVisible(); expect(api.requests.find(r => r.path === '/auth/register')?.body.preferredContact).toBe('Email'); });
  17 | test('password reset link and forgot-password use the existing API', async ({ page }) => { const api = await mockApi(page, 'patient', false); await page.goto('/#reset=sample-token'); await page.getByLabel('New password', { exact: true }).fill('new-password-123'); await page.getByLabel('Confirm new password').fill('new-password-123'); await page.getByRole('button', { name: 'Update password' }).click(); await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible(); expect(api.requests.find(r => r.path === '/auth/reset-password')?.body.token).toBe('sample-token'); await page.getByRole('button', { name: 'Forgot password?' }).click(); await page.getByRole('button', { name: 'Send reset link' }).click(); expect(api.requests.some(r => r.path === '/auth/forgot-password')).toBe(true); });
  18 | test('patient booking respects busy and blocked slots and supports calendar modes', async ({ page }) => {
  19 |   const api = await mockApi(page, 'patient'); await page.goto('/patient/book'); await page.getByLabel('Practice location').selectOption('Online'); await page.getByLabel('Appointment date').fill('2027-01-04');
  20 |   const monday = page.getByRole('button', { name: /10:00 – 11:00.*Dr Test Provider.*Not available/ }).first(); await expect(monday).toBeDisabled(); await expect(page.getByRole('button', { name: /12:00 – 13:00.*Not available/ }).first()).toBeDisabled(); await page.getByRole('button', { name: /09:00 – 10:00.*Available/ }).first().click(); await page.getByLabel('Note for provider').fill('Please call first'); await page.getByRole('button', { name: 'Confirm Booking' }).click(); await expect(page).toHaveURL(/patient\/appointments/); expect(api.requests.find(r => r.path === '/appointments' && r.method === 'POST')?.body.mode).toBe('Online'); await page.getByRole('button', { name: 'Month ›' }).click(); await expect(page.locator('.month-board')).toBeVisible(); await page.getByRole('button', { name: 'Today', exact: true }).click(); await expect(page.locator('.day-shell')).toBeVisible();
  21 | });
> 22 | test('booking details escape user text, show meeting link, and cancel through the API', async ({ page }) => { const api = await mockApi(page, 'patient'); await page.goto('/patient/appointments'); await page.getByRole('button', { name: 'View', exact: true }).first().click(); const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('<img src=x'); expect(await page.evaluate(() => (window as Window & { __unsafe?: boolean }).__unsafe)).toBeUndefined(); await expect(dialog.getByRole('link', { name: 'Join session' })).toHaveAttribute('href', 'https://example.test/session'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toHaveCount(0); expect(api.requests.some(r => r.path === '/appointments/appointment-1/status' && r.body.status === 'Cancelled')).toBe(true); });
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
  23 | test('provider availability and patient profile persist via correct endpoints', async ({ page }) => { const api = await mockApi(page, 'provider'); await page.goto('/provider/availability'); await page.getByLabel('Monday start').fill('08:30'); await page.getByRole('button', { name: 'Save weekly availability' }).click(); await expect(page.getByRole('status')).toHaveText('Availability saved to WannaTalk'); expect(api.requests.some(r => r.path === '/providers/provider-1/availability' && r.method === 'PUT')).toBe(true); });
  24 | test('patient profile saves and survives a reload', async ({ page }) => { const api = await mockApi(page, 'patient'); await page.goto('/patient/profile'); await page.getByLabel('Name', { exact: true }).fill('Updated Patient'); await page.getByRole('button', { name: 'Save profile' }).click(); await expect(page.getByRole('status')).toHaveText('Profile saved'); await page.reload(); await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Updated Patient'); expect(api.requests.some(r => r.path === '/patients/me' && r.method === 'PATCH')).toBe(true); });
  25 | test('admin booking, registration approval and account editing', async ({ page }) => { const api = await mockApi(page, 'admin'); await page.goto('/admin/appointments'); await page.getByRole('button', { name: '＋ Create booking' }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await dialog.getByLabel('Provider', { exact: true }).selectOption('provider-1'); await dialog.getByLabel('Location', { exact: true }).selectOption('online'); await dialog.getByLabel('Appointment date').fill('2027-01-04'); await dialog.getByLabel('Available time').selectOption('09:00'); await dialog.getByRole('button', { name: 'Create booking', exact: true }).click(); await expect(dialog).toHaveCount(0); await page.goto('/admin/registrations'); await page.getByRole('button', { name: 'Approve', exact: true }).click(); await expect(page.getByText('No pending registration requests.')).toBeVisible(); await page.goto('/admin/patients'); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByRole('dialog').getByLabel('Full name').fill('Edited Patient'); await page.getByRole('button', { name: 'Save changes' }).click(); await expect(page.getByRole('cell', { name: 'Edited Patient', exact: true })).toBeVisible(); expect(api.unexpected).toEqual([]); });
  26 | test('follow-up notes stay out of message payload and delivery history renders', async ({ page }) => { const api = await mockApi(page, 'provider'); await page.goto('/provider/followups'); await page.getByRole('button', { name: '＋ Create follow-up' }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await dialog.getByLabel('Private internal note').fill('Confidential'); await dialog.getByLabel('Patient reminder message').fill('Please arrange a session'); await dialog.getByRole('button', { name: 'Save follow-up' }).click(); await expect(dialog).toHaveCount(0); await page.goto('/provider/messages'); await page.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await page.getByLabel('Message', { exact: true }).fill('Hello patient'); await page.getByRole('button', { name: 'Send message', exact: true }).click(); await expect(page.getByRole('status')).toContainText('1 delivered'); const sent = api.requests.find(r => r.path === '/communications/send'); expect(sent?.body).not.toHaveProperty('internalNote'); await page.getByRole('button', { name: 'View', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('Hello patient'); });
  27 | test('waiting-list join, matching and notification', async ({ page }) => { const api = await mockApi(page, 'admin'); await page.goto('/admin/waiting'); await page.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await page.getByRole('button', { name: 'Add patient', exact: true }).click(); await expect(page.getByRole('status')).toHaveText('Added to cancellation list'); await page.getByLabel('Cancelled appointment').selectOption('cancelled-1'); await page.getByRole('button', { name: 'Find matches' }).click(); await page.getByRole('button', { name: 'Notify', exact: true }).first().click(); await expect(page.getByRole('status')).toContainText('1 delivered'); expect(api.unexpected).toEqual([]); });
  28 | test('role guard, mobile drawer, and visual screenshots', async ({ page }) => { await mockApi(page, 'patient'); await page.goto('/admin/registrations'); await expect(page).toHaveURL(/patient\/book/); await page.screenshot({ path: test.info().outputPath('patient-desktop.png'), fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Open navigation' }).click(); await expect(page.getByRole('navigation')).toBeVisible(); await page.getByRole('navigation').getByRole('button', { name: /My Profile/ }).click(); await expect(page).toHaveURL(/patient\/profile/); await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false'); await page.screenshot({ path: test.info().outputPath('patient-mobile.png'), fullPage: true }); });
  29 | 
```