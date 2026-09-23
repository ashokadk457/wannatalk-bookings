# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> follow-up notes stay out of message payload and delivery history renders
- Location: src\tests\browser\app.spec.ts:26:1

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
    - navigation "provider navigation" [ref=e7]:
      - button "▣ Dashboard" [ref=e8] [cursor=pointer]
      - button "▦ Calendar" [ref=e9] [cursor=pointer]
      - button "◷ Availability" [ref=e10] [cursor=pointer]
      - button "◉ Patients" [ref=e11] [cursor=pointer]
      - button "✓ Follow-ups" [ref=e12] [cursor=pointer]
      - button "✉ Messages" [ref=e13] [cursor=pointer]
      - button "⚙ Provider Profile" [ref=e14] [cursor=pointer]
    - generic [ref=e15]:
      - generic [ref=e16]: ● Online
      - checkbox "Provider online status" [checked] [ref=e17]
      - generic [ref=e18]: Patients can book while you are offline.
    - generic [ref=e19]:
      - generic [ref=e20]: PT
      - generic [ref=e21]:
        - strong [ref=e22]: provider Test
        - generic [ref=e23]: Counsellor
    - button "Log out" [ref=e24] [cursor=pointer]
  - main [ref=e25]:
    - generic [ref=e26]:
      - generic [ref=e27]:
        - heading "Follow-ups" [level=2] [ref=e28]
        - paragraph [ref=e29]: Capture bookings, reminders and patient updates from one clear dashboard.
      - generic [ref=e30]: Wed, 23 Sept 2026
    - generic [ref=e32]:
      - generic [ref=e33]:
        - generic [ref=e35]:
          - heading "Follow-ups" [level=2] [ref=e36]
          - paragraph [ref=e37]: Internal notes remain private. Only the reminder message is sent.
        - button "＋ Create follow-up" [ref=e38] [cursor=pointer]
      - article [ref=e39]:
        - table [ref=e41]:
          - rowgroup [ref=e42]:
            - row [ref=e43]:
              - columnheader "Patient" [ref=e44]
              - columnheader "Provider" [ref=e45]
              - columnheader "Due" [ref=e46]
              - columnheader "Internal note" [ref=e47]
              - columnheader "Reminder" [ref=e48]
              - columnheader "Status" [ref=e49]
              - columnheader "Actions" [ref=e50]
          - rowgroup [ref=e51]:
            - row [ref=e52]:
              - cell "Test Patient" [ref=e53]
              - cell "Dr Test Provider" [ref=e54]
              - cell "2027/01/04, 15:30:00" [ref=e55]
              - cell "Private note" [ref=e56]
              - cell "email Not sent" [ref=e58]:
                - text: email
                - generic [ref=e59]: Not sent
              - cell "open" [ref=e60]
              - cell [ref=e62]:
                - generic [ref=e63]:
                  - button "Send reminder" [ref=e64] [cursor=pointer]
                  - button "Complete" [ref=e65] [cursor=pointer]
                  - button "Cancel" [ref=e66] [cursor=pointer]
      - dialog "Create follow-up" [ref=e67]:
        - generic [ref=e68]:
          - heading "Create follow-up" [level=3] [ref=e69]
          - button "Close" [active] [ref=e70] [cursor=pointer]
        - generic [ref=e71]: The internal note is private and is never included in Email or SMS messages.
        - group [ref=e73]:
          - generic [ref=e74]:
            - generic [ref=e75]:
              - generic [ref=e76]: Patient
              - combobox "Patient" [ref=e77]:
                - option "Choose patient" [selected]
                - option "Test Patient · patient@example.test"
            - generic [ref=e78]:
              - generic [ref=e79]: Provider
              - combobox "Provider" [disabled] [ref=e80]:
                - option "Choose provider"
                - option "Dr Test Provider" [selected]
            - generic [ref=e81]:
              - generic [ref=e82]: Follow-up date
              - textbox "Follow-up date" [ref=e83]: 2026-09-24
            - generic [ref=e84]:
              - generic [ref=e85]: Time
              - textbox "Time" [ref=e86]: 10:00
            - generic [ref=e87]:
              - generic [ref=e88]: Private internal note
              - textbox "Private internal note" [ref=e89]
            - generic [ref=e90]:
              - generic [ref=e91]: Patient reminder message
              - textbox "Patient reminder message" [ref=e92]: "WannaTalk reminder: please contact us to arrange your recommended follow-up session."
            - group "Delivery channels" [ref=e93]:
              - generic [ref=e95]:
                - generic [ref=e96]:
                  - checkbox "Email" [checked] [ref=e97]
                  - text: Email
                - generic [ref=e98]:
                  - checkbox "SMS" [checked] [ref=e99]
                  - text: SMS
          - button "Save follow-up" [ref=e100] [cursor=pointer]
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
  25 | test('admin booking, registration approval and account editing', async ({ page }) => { const api = await mockApi(page, 'admin'); await page.goto('/admin/appointments'); await page.getByRole('button', { name: '＋ Create booking' }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await dialog.getByLabel('Provider', { exact: true }).selectOption('provider-1'); await dialog.getByLabel('Location', { exact: true }).selectOption('online'); await dialog.getByLabel('Appointment date').fill('2027-01-04'); await dialog.getByLabel('Available time').selectOption('09:00'); await dialog.getByRole('button', { name: 'Create booking', exact: true }).click(); await expect(dialog).toHaveCount(0); await page.goto('/admin/registrations'); await page.getByRole('button', { name: 'Approve', exact: true }).click(); await expect(page.getByText('No pending registration requests.')).toBeVisible(); await page.goto('/admin/patients'); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByRole('dialog').getByLabel('Full name').fill('Edited Patient'); await page.getByRole('button', { name: 'Save changes' }).click(); await expect(page.getByRole('cell', { name: 'Edited Patient', exact: true })).toBeVisible(); expect(api.unexpected).toEqual([]); });
> 26 | test('follow-up notes stay out of message payload and delivery history renders', async ({ page }) => { const api = await mockApi(page, 'provider'); await page.goto('/provider/followups'); await page.getByRole('button', { name: '＋ Create follow-up' }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await dialog.getByLabel('Private internal note').fill('Confidential'); await dialog.getByLabel('Patient reminder message').fill('Please arrange a session'); await dialog.getByRole('button', { name: 'Save follow-up' }).click(); await expect(dialog).toHaveCount(0); await page.goto('/provider/messages'); await page.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await page.getByLabel('Message', { exact: true }).fill('Hello patient'); await page.getByRole('button', { name: 'Send message', exact: true }).click(); await expect(page.getByRole('status')).toContainText('1 delivered'); const sent = api.requests.find(r => r.path === '/communications/send'); expect(sent?.body).not.toHaveProperty('internalNote'); await page.getByRole('button', { name: 'View', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('Hello patient'); });
     |                                                                                                                                                                                                                                                                                                                                                                  ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
  27 | test('waiting-list join, matching and notification', async ({ page }) => { const api = await mockApi(page, 'admin'); await page.goto('/admin/waiting'); await page.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await page.getByRole('button', { name: 'Add patient', exact: true }).click(); await expect(page.getByRole('status')).toHaveText('Added to cancellation list'); await page.getByLabel('Cancelled appointment').selectOption('cancelled-1'); await page.getByRole('button', { name: 'Find matches' }).click(); await page.getByRole('button', { name: 'Notify', exact: true }).first().click(); await expect(page.getByRole('status')).toContainText('1 delivered'); expect(api.unexpected).toEqual([]); });
  28 | test('role guard, mobile drawer, and visual screenshots', async ({ page }) => { await mockApi(page, 'patient'); await page.goto('/admin/registrations'); await expect(page).toHaveURL(/patient\/book/); await page.screenshot({ path: test.info().outputPath('patient-desktop.png'), fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Open navigation' }).click(); await expect(page.getByRole('navigation')).toBeVisible(); await page.getByRole('navigation').getByRole('button', { name: /My Profile/ }).click(); await expect(page).toHaveURL(/patient\/profile/); await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false'); await page.screenshot({ path: test.info().outputPath('patient-mobile.png'), fullPage: true }); });
  29 | 
```