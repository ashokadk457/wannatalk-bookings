# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> admin booking, registration approval and account editing
- Location: src\tests\browser\app.spec.ts:25:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('dialog').getByLabel('Patient', { exact: true })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - img "WannaTalk — You are not alone" [ref=e6]
    - navigation "admin navigation" [ref=e7]:
      - button "▣ Admin overview" [ref=e8] [cursor=pointer]
      - button "▦ Appointments" [ref=e9] [cursor=pointer]
      - button "◉ Providers" [ref=e10] [cursor=pointer]
      - button "◉ Patients" [ref=e11] [cursor=pointer]
      - button "! Cancellations" [ref=e12] [cursor=pointer]
      - button "◷ Provider availability" [ref=e13] [cursor=pointer]
      - button "✓ Follow-ups" [ref=e14] [cursor=pointer]
      - button "◷ Waiting list" [ref=e15] [cursor=pointer]
      - button "✉ Messages" [ref=e16] [cursor=pointer]
      - button "♥ System health" [ref=e17] [cursor=pointer]
      - button "＋ Registrations" [ref=e18] [cursor=pointer]
      - button "▤ Audit Log" [ref=e19] [cursor=pointer]
    - generic [ref=e20]:
      - generic [ref=e21]: AT
      - generic [ref=e22]:
        - strong [ref=e23]: admin Test
        - generic [ref=e24]: Administrator
    - button "Log out" [ref=e25] [cursor=pointer]
  - main [ref=e26]:
    - generic [ref=e27]:
      - generic [ref=e28]:
        - heading "Appointments" [level=2] [ref=e29]
        - paragraph [ref=e30]: Appointments, registrations and provider presence across the practice.
      - generic [ref=e31]: Wed, 23 Sept 2026
    - generic [ref=e33]:
      - generic [ref=e34]:
        - generic [ref=e36]:
          - heading "All appointments" [level=2] [ref=e37]
          - paragraph [ref=e38]: Search, filter and update every booking.
        - button "＋ Create booking" [ref=e39] [cursor=pointer]
      - article [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]:
            - generic [ref=e43]: Search appointments
            - textbox "Search appointments" [ref=e44]:
              - /placeholder: Patient, provider or appointment type
          - generic [ref=e45]:
            - generic [ref=e46]: Provider filter
            - combobox "Provider filter" [ref=e47]:
              - option "All providers" [selected]
              - option "Dr Test Provider"
          - generic [ref=e48]:
            - generic [ref=e49]: Status filter
            - combobox "Status filter" [ref=e50]:
              - option "All statuses" [selected]
              - option "Booked"
              - option "Confirmed"
              - option "Arrived"
              - option "Completed"
              - option "Cancelled"
              - option "No-show"
          - generic [ref=e51]:
            - generic [ref=e52]: Sort appointments
            - combobox "Sort appointments" [ref=e53]:
              - option "Soonest first" [selected]
              - option "Latest first"
        - table [ref=e55]:
          - rowgroup [ref=e56]:
            - row [ref=e57]:
              - columnheader "Date" [ref=e58]
              - columnheader "Time" [ref=e59]
              - columnheader "Patient" [ref=e60]
              - columnheader "Provider" [ref=e61]
              - columnheader "Type / location" [ref=e62]
              - columnheader "Status" [ref=e63]
              - columnheader "Actions" [ref=e64]
          - rowgroup [ref=e65]:
            - row [ref=e66]:
              - cell "04 Jan 2027" [ref=e67]
              - cell "10:00 60 min" [ref=e68]:
                - strong [ref=e69]: 10:00
                - generic [ref=e70]: 60 min
              - cell "Test Patient +27000000000" [ref=e71]:
                - generic [ref=e72]: Test Patient
                - generic [ref=e73]: "+27000000000"
              - cell "Dr Test Provider Counsellor" [ref=e74]:
                - generic [ref=e75]: Dr Test Provider
                - generic [ref=e76]: Counsellor
              - cell "Individual counselling 📍 Online Online session link Join session https://example.test/session Intake selected" [ref=e77]:
                - text: Individual counselling
                - generic [ref=e78]: 📍 Online
                - generic [ref=e79]:
                  - strong [ref=e80]: Online session link
                  - link "Join session" [ref=e81] [cursor=pointer]:
                    - /url: https://example.test/session
                  - generic [ref=e82]: https://example.test/session
                - generic [ref=e83]: Intake selected
              - cell "Booked" [ref=e84]:
                - combobox "Status for Test Patient on 2027-01-04" [ref=e85]:
                  - option "Booked" [selected]
                  - option "Confirmed"
                  - option "Arrived"
                  - option "Completed"
                  - option "Cancelled"
                  - option "No-show"
              - cell [ref=e86]:
                - generic [ref=e87]:
                  - button "View" [ref=e88] [cursor=pointer]
                  - button "Reschedule" [ref=e89] [cursor=pointer]
                  - button "Cancel" [ref=e90] [cursor=pointer]
                  - button "Delete" [ref=e91] [cursor=pointer]
                - button "Message" [ref=e92] [cursor=pointer]
            - row [ref=e93]:
              - cell "04 Jan 2027" [ref=e94]
              - cell "11:00 60 min" [ref=e95]:
                - strong [ref=e96]: 11:00
                - generic [ref=e97]: 60 min
              - cell "Test Patient +27000000000" [ref=e98]:
                - generic [ref=e99]: Test Patient
                - generic [ref=e100]: "+27000000000"
              - cell "Dr Test Provider Counsellor" [ref=e101]:
                - generic [ref=e102]: Dr Test Provider
                - generic [ref=e103]: Counsellor
              - cell "Individual counselling 📍 Online Online session link Join session https://example.test/session Intake selected" [ref=e104]:
                - text: Individual counselling
                - generic [ref=e105]: 📍 Online
                - generic [ref=e106]:
                  - strong [ref=e107]: Online session link
                  - link "Join session" [ref=e108] [cursor=pointer]:
                    - /url: https://example.test/session
                  - generic [ref=e109]: https://example.test/session
                - generic [ref=e110]: Intake selected
              - cell "Cancelled" [ref=e111]:
                - combobox "Status for Test Patient on 2027-01-04" [ref=e112]:
                  - option "Booked"
                  - option "Confirmed"
                  - option "Arrived"
                  - option "Completed"
                  - option "Cancelled" [selected]
                  - option "No-show"
              - cell [ref=e113]:
                - generic [ref=e114]:
                  - button "View" [ref=e115] [cursor=pointer]
                  - button "Delete" [ref=e116] [cursor=pointer]
                - button "Message" [ref=e117] [cursor=pointer]
      - dialog "Create booking" [ref=e118]:
        - generic [ref=e119]:
          - heading "Create booking" [level=3] [ref=e120]
          - button "Close" [active] [ref=e121] [cursor=pointer]
        - group [ref=e123]:
          - generic [ref=e124]:
            - generic [ref=e125]:
              - generic [ref=e126]: Patient
              - combobox "Patient" [ref=e127]:
                - option "Choose patient" [selected]
                - option "Test Patient · patient@example.test"
            - generic [ref=e128]:
              - generic [ref=e129]: Provider
              - combobox "Provider" [ref=e130]:
                - option "Choose provider" [selected]
                - option "Dr Test Provider"
            - generic [ref=e131]:
              - generic [ref=e132]: Location
              - combobox "Location" [ref=e133]:
                - option "Choose location" [selected]
            - generic [ref=e134]:
              - generic [ref=e135]: Appointment date
              - textbox "Appointment date" [ref=e136]: 2026-09-23
            - generic [ref=e137]:
              - generic [ref=e138]: Available time
              - combobox "Available time" [ref=e139]:
                - option "No available slots" [selected]
            - generic [ref=e140]:
              - generic [ref=e141]: Appointment type
              - combobox "Appointment type" [ref=e142]:
                - option "Individual counselling" [selected]
                - option "Couples counselling"
                - option "Family counselling"
                - option "Assessment"
                - option "Follow-up"
            - generic [ref=e143]:
              - generic [ref=e144]: Mode
              - combobox "Mode" [ref=e145]:
                - option "In-person" [selected]
                - option "Online"
                - option "Telephone"
            - generic [ref=e146]:
              - generic [ref=e147]: Note
              - textbox "Note" [ref=e148]
            - generic [ref=e149]:
              - checkbox "Optional private intake" [ref=e150]
              - text: Optional private intake
          - button "Create booking" [ref=e151] [cursor=pointer]
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
  22 | test('booking details escape user text, show meeting link, and cancel through the API', async ({ page }) => { const api = await mockApi(page, 'patient'); await page.goto('/patient/appointments'); await page.getByRole('button', { name: 'View', exact: true }).first().click(); const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('<img src=x'); expect(await page.evaluate(() => (window as Window & { __unsafe?: boolean }).__unsafe)).toBeUndefined(); await expect(dialog.getByRole('link', { name: 'Join session' })).toHaveAttribute('href', 'https://example.test/session'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toHaveCount(0); expect(api.requests.some(r => r.path === '/appointments/appointment-1/status' && r.body.status === 'Cancelled')).toBe(true); });
  23 | test('provider availability and patient profile persist via correct endpoints', async ({ page }) => { const api = await mockApi(page, 'provider'); await page.goto('/provider/availability'); await page.getByLabel('Monday start').fill('08:30'); await page.getByRole('button', { name: 'Save weekly availability' }).click(); await expect(page.getByRole('status')).toHaveText('Availability saved to WannaTalk'); expect(api.requests.some(r => r.path === '/providers/provider-1/availability' && r.method === 'PUT')).toBe(true); });
  24 | test('patient profile saves and survives a reload', async ({ page }) => { const api = await mockApi(page, 'patient'); await page.goto('/patient/profile'); await page.getByLabel('Name', { exact: true }).fill('Updated Patient'); await page.getByRole('button', { name: 'Save profile' }).click(); await expect(page.getByRole('status')).toHaveText('Profile saved'); await page.reload(); await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Updated Patient'); expect(api.requests.some(r => r.path === '/patients/me' && r.method === 'PATCH')).toBe(true); });
> 25 | test('admin booking, registration approval and account editing', async ({ page }) => { const api = await mockApi(page, 'admin'); await page.goto('/admin/appointments'); await page.getByRole('button', { name: '＋ Create booking' }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await dialog.getByLabel('Provider', { exact: true }).selectOption('provider-1'); await dialog.getByLabel('Location', { exact: true }).selectOption('online'); await dialog.getByLabel('Appointment date').fill('2027-01-04'); await dialog.getByLabel('Available time').selectOption('09:00'); await dialog.getByRole('button', { name: 'Create booking', exact: true }).click(); await expect(dialog).toHaveCount(0); await page.goto('/admin/registrations'); await page.getByRole('button', { name: 'Approve', exact: true }).click(); await expect(page.getByText('No pending registration requests.')).toBeVisible(); await page.goto('/admin/patients'); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByRole('dialog').getByLabel('Full name').fill('Edited Patient'); await page.getByRole('button', { name: 'Save changes' }).click(); await expect(page.getByRole('cell', { name: 'Edited Patient', exact: true })).toBeVisible(); expect(api.unexpected).toEqual([]); });
     |                                                                                                                                                                                                                                                                                                                                             ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
  26 | test('follow-up notes stay out of message payload and delivery history renders', async ({ page }) => { const api = await mockApi(page, 'provider'); await page.goto('/provider/followups'); await page.getByRole('button', { name: '＋ Create follow-up' }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await dialog.getByLabel('Private internal note').fill('Confidential'); await dialog.getByLabel('Patient reminder message').fill('Please arrange a session'); await dialog.getByRole('button', { name: 'Save follow-up' }).click(); await expect(dialog).toHaveCount(0); await page.goto('/provider/messages'); await page.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await page.getByLabel('Message', { exact: true }).fill('Hello patient'); await page.getByRole('button', { name: 'Send message', exact: true }).click(); await expect(page.getByRole('status')).toContainText('1 delivered'); const sent = api.requests.find(r => r.path === '/communications/send'); expect(sent?.body).not.toHaveProperty('internalNote'); await page.getByRole('button', { name: 'View', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('Hello patient'); });
  27 | test('waiting-list join, matching and notification', async ({ page }) => { const api = await mockApi(page, 'admin'); await page.goto('/admin/waiting'); await page.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await page.getByRole('button', { name: 'Add patient', exact: true }).click(); await expect(page.getByRole('status')).toHaveText('Added to cancellation list'); await page.getByLabel('Cancelled appointment').selectOption('cancelled-1'); await page.getByRole('button', { name: 'Find matches' }).click(); await page.getByRole('button', { name: 'Notify', exact: true }).first().click(); await expect(page.getByRole('status')).toContainText('1 delivered'); expect(api.unexpected).toEqual([]); });
  28 | test('role guard, mobile drawer, and visual screenshots', async ({ page }) => { await mockApi(page, 'patient'); await page.goto('/admin/registrations'); await expect(page).toHaveURL(/patient\/book/); await page.screenshot({ path: test.info().outputPath('patient-desktop.png'), fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Open navigation' }).click(); await expect(page.getByRole('navigation')).toBeVisible(); await page.getByRole('navigation').getByRole('button', { name: /My Profile/ }).click(); await expect(page).toHaveURL(/patient\/profile/); await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false'); await page.screenshot({ path: test.info().outputPath('patient-mobile.png'), fullPage: true }); });
  29 | 
```