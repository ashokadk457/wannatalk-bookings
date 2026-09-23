# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> registration continues through contact verification
- Location: src\tests\browser\app.spec.ts:16:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Password', { exact: true })

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - img "WannaTalk — You are not alone" [ref=e8]
      - heading "One booking system. Simple, connected care." [level=2] [ref=e9]: One booking system.Simple, connected care.
      - paragraph [ref=e10]: Patients book available sessions while providers manage their calendars and communication in one place.
    - generic [ref=e11]: Copyright WannaTalk™ 2026
  - generic [ref=e12]:
    - button "← Back" [ref=e13] [cursor=pointer]
    - heading "Patient access" [level=2] [ref=e14]
    - generic [ref=e15]:
      - button "Login" [ref=e16] [cursor=pointer]
      - button "Register" [ref=e17] [cursor=pointer]
    - group [ref=e19]:
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]: Full name
          - textbox "Full name" [ref=e23]: New Patient
        - generic [ref=e24]:
          - generic [ref=e25]: Email
          - textbox "Email" [active] [ref=e26]: new@example.test
        - generic [ref=e27]:
          - generic [ref=e28]: Mobile / SMS
          - textbox "Mobile / SMS" [ref=e29]
        - generic [ref=e30]:
          - generic [ref=e31]: Preferred contact
          - combobox "Preferred contact" [ref=e32]:
            - option "Email" [selected]
            - option "SMS"
            - option "Both"
        - generic [ref=e33]:
          - generic [ref=e34]: Password
          - textbox "Password Use at least 12 characters." [ref=e35]
          - generic [ref=e36]: Use at least 12 characters.
        - generic [ref=e37]: Verify your contact details to activate your account. Accounts created by an administrator require MFA at login.
      - button "Create account" [ref=e38] [cursor=pointer]
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
> 16 | test('registration continues through contact verification', async ({ page }) => { const api = await mockApi(page, 'patient', false); await page.goto('/login'); await page.getByRole('button', { name: '👤 Patient' }).click(); await page.getByRole('button', { name: 'Register', exact: true }).click(); await page.getByLabel('Full name').fill('New Patient'); await page.getByLabel('Email', { exact: true }).fill('new@example.test'); await page.getByLabel('Password', { exact: true }).fill('test-password-123'); await page.getByRole('button', { name: 'Create account' }).click(); await expect(page.getByRole('heading', { name: 'Security verification' })).toBeVisible(); expect(api.requests.find(r => r.path === '/auth/register')?.body.preferredContact).toBe('Email'); });
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  17 | test('password reset link and forgot-password use the existing API', async ({ page }) => { const api = await mockApi(page, 'patient', false); await page.goto('/#reset=sample-token'); await page.getByLabel('New password', { exact: true }).fill('new-password-123'); await page.getByLabel('Confirm new password').fill('new-password-123'); await page.getByRole('button', { name: 'Update password' }).click(); await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible(); expect(api.requests.find(r => r.path === '/auth/reset-password')?.body.token).toBe('sample-token'); await page.getByRole('button', { name: 'Forgot password?' }).click(); await page.getByRole('button', { name: 'Send reset link' }).click(); expect(api.requests.some(r => r.path === '/auth/forgot-password')).toBe(true); });
  18 | test('patient booking respects busy and blocked slots and supports calendar modes', async ({ page }) => {
  19 |   const api = await mockApi(page, 'patient'); await page.goto('/patient/book'); await page.getByLabel('Practice location').selectOption('Online'); await page.getByLabel('Appointment date').fill('2027-01-04');
  20 |   const monday = page.getByRole('button', { name: /10:00 – 11:00.*Dr Test Provider.*Not available/ }).first(); await expect(monday).toBeDisabled(); await expect(page.getByRole('button', { name: /12:00 – 13:00.*Not available/ }).first()).toBeDisabled(); await page.getByRole('button', { name: /09:00 – 10:00.*Available/ }).first().click(); await page.getByLabel('Note for provider').fill('Please call first'); await page.getByRole('button', { name: 'Confirm Booking' }).click(); await expect(page).toHaveURL(/patient\/appointments/); expect(api.requests.find(r => r.path === '/appointments' && r.method === 'POST')?.body.mode).toBe('Online'); await page.getByRole('button', { name: 'Month ›' }).click(); await expect(page.locator('.month-board')).toBeVisible(); await page.getByRole('button', { name: 'Today', exact: true }).click(); await expect(page.locator('.day-shell')).toBeVisible();
  21 | });
  22 | test('booking details escape user text, show meeting link, and cancel through the API', async ({ page }) => { const api = await mockApi(page, 'patient'); await page.goto('/patient/appointments'); await page.getByRole('button', { name: 'View', exact: true }).first().click(); const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('<img src=x'); expect(await page.evaluate(() => (window as Window & { __unsafe?: boolean }).__unsafe)).toBeUndefined(); await expect(dialog.getByRole('link', { name: 'Join session' })).toHaveAttribute('href', 'https://example.test/session'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toHaveCount(0); expect(api.requests.some(r => r.path === '/appointments/appointment-1/status' && r.body.status === 'Cancelled')).toBe(true); });
  23 | test('provider availability and patient profile persist via correct endpoints', async ({ page }) => { const api = await mockApi(page, 'provider'); await page.goto('/provider/availability'); await page.getByLabel('Monday start').fill('08:30'); await page.getByRole('button', { name: 'Save weekly availability' }).click(); await expect(page.getByRole('status')).toHaveText('Availability saved to WannaTalk'); expect(api.requests.some(r => r.path === '/providers/provider-1/availability' && r.method === 'PUT')).toBe(true); });
  24 | test('patient profile saves and survives a reload', async ({ page }) => { const api = await mockApi(page, 'patient'); await page.goto('/patient/profile'); await page.getByLabel('Name', { exact: true }).fill('Updated Patient'); await page.getByRole('button', { name: 'Save profile' }).click(); await expect(page.getByRole('status')).toHaveText('Profile saved'); await page.reload(); await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Updated Patient'); expect(api.requests.some(r => r.path === '/patients/me' && r.method === 'PATCH')).toBe(true); });
  25 | test('admin booking, registration approval and account editing', async ({ page }) => { const api = await mockApi(page, 'admin'); await page.goto('/admin/appointments'); await page.getByRole('button', { name: '＋ Create booking' }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await dialog.getByLabel('Provider', { exact: true }).selectOption('provider-1'); await dialog.getByLabel('Location', { exact: true }).selectOption('online'); await dialog.getByLabel('Appointment date').fill('2027-01-04'); await dialog.getByLabel('Available time').selectOption('09:00'); await dialog.getByRole('button', { name: 'Create booking', exact: true }).click(); await expect(dialog).toHaveCount(0); await page.goto('/admin/registrations'); await page.getByRole('button', { name: 'Approve', exact: true }).click(); await expect(page.getByText('No pending registration requests.')).toBeVisible(); await page.goto('/admin/patients'); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByRole('dialog').getByLabel('Full name').fill('Edited Patient'); await page.getByRole('button', { name: 'Save changes' }).click(); await expect(page.getByRole('cell', { name: 'Edited Patient', exact: true })).toBeVisible(); expect(api.unexpected).toEqual([]); });
  26 | test('follow-up notes stay out of message payload and delivery history renders', async ({ page }) => { const api = await mockApi(page, 'provider'); await page.goto('/provider/followups'); await page.getByRole('button', { name: '＋ Create follow-up' }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await dialog.getByLabel('Private internal note').fill('Confidential'); await dialog.getByLabel('Patient reminder message').fill('Please arrange a session'); await dialog.getByRole('button', { name: 'Save follow-up' }).click(); await expect(dialog).toHaveCount(0); await page.goto('/provider/messages'); await page.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await page.getByLabel('Message', { exact: true }).fill('Hello patient'); await page.getByRole('button', { name: 'Send message', exact: true }).click(); await expect(page.getByRole('status')).toContainText('1 delivered'); const sent = api.requests.find(r => r.path === '/communications/send'); expect(sent?.body).not.toHaveProperty('internalNote'); await page.getByRole('button', { name: 'View', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('Hello patient'); });
  27 | test('waiting-list join, matching and notification', async ({ page }) => { const api = await mockApi(page, 'admin'); await page.goto('/admin/waiting'); await page.getByLabel('Patient', { exact: true }).selectOption('patient-1'); await page.getByRole('button', { name: 'Add patient', exact: true }).click(); await expect(page.getByRole('status')).toHaveText('Added to cancellation list'); await page.getByLabel('Cancelled appointment').selectOption('cancelled-1'); await page.getByRole('button', { name: 'Find matches' }).click(); await page.getByRole('button', { name: 'Notify', exact: true }).first().click(); await expect(page.getByRole('status')).toContainText('1 delivered'); expect(api.unexpected).toEqual([]); });
  28 | test('role guard, mobile drawer, and visual screenshots', async ({ page }) => { await mockApi(page, 'patient'); await page.goto('/admin/registrations'); await expect(page).toHaveURL(/patient\/book/); await page.screenshot({ path: test.info().outputPath('patient-desktop.png'), fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Open navigation' }).click(); await expect(page.getByRole('navigation')).toBeVisible(); await page.getByRole('navigation').getByRole('button', { name: /My Profile/ }).click(); await expect(page).toHaveURL(/patient\/profile/); await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false'); await page.screenshot({ path: test.info().outputPath('patient-mobile.png'), fullPage: true }); });
  29 | 
```