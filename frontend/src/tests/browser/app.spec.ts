import { test, expect } from '@playwright/test';
import { mockApi } from './fixtures';
import { navigation } from '../../app/navigation';
import type { Role } from '../../types';
test('reschedule, status update, delete and provider activation', async ({ page }) => {
  const api = await mockApi(page, 'admin');
  await page.goto('/admin/appointments');
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'Reschedule', exact: true }) });
  await row.getByRole('button', { name: 'Reschedule', exact: true }).click();
  await page.getByLabel('New appointment date').fill('2027-01-05');
  await page.getByLabel('New appointment time').fill('09:00');
  await page.getByRole('button', { name: 'Save new time' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(api.requests.find((r) => r.path.endsWith('/reschedule'))?.body.appointmentDate).toBe(
    '2027-01-05',
  );
  await page.getByLabel('Status for Test Patient on 2027-01-05').selectOption('Confirmed');
  await expect(page.locator('.toast')).toHaveText('Appointment status updated');
  await page
    .getByRole('row')
    .filter({ hasText: '05 Jan 2027' })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(page.locator('.toast')).toHaveText('Booking deleted and audit log updated');
  await page.goto('/admin/providers');
  await page.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reactivate', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reactivate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Deactivate', exact: true })).toBeVisible();
  expect(api.unexpected).toEqual([]);
});
test('provider profile and online toggle use existing API contracts', async ({ page }) => {
  const api = await mockApi(page, 'provider');
  await page.goto('/provider/profile');
  await page.getByLabel('Display name').fill('Updated Provider');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.locator('.toast')).toHaveText('Profile saved');
  expect(api.requests.some((r) => r.path === '/providers/provider-1/profile')).toBe(true);
  await page.getByLabel('Provider online status').uncheck();
  await expect(page.getByLabel('Provider online status')).not.toBeChecked();
  expect(
    api.requests.some(
      (r) => r.path === '/providers/provider-1/status' && r.body.isOnline === false,
    ),
  ).toBe(true);
});
test('session expiration clears protected content', async ({ page }) => {
  await mockApi(page, 'patient');
  await page.goto('/patient/profile');
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
  await page.route('**/api/patients/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Invalid or expired login' }),
    }),
  );
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('navigation')).toHaveCount(0);
});
test('provider registration remains pending after verification', async ({ page }) => {
  await mockApi(page, 'provider', false);
  await page.route('**/api/auth/mfa/verify', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'pending',
        role: 'provider',
        message: 'Contact verified. Awaiting administrator approval.',
      }),
    }),
  );
  await page.goto('/login');
  await page.getByRole('button', { name: '🩺 Provider' }).click();
  await page.getByLabel('Email', { exact: true }).fill('provider@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Login', exact: true }).last().click();
  await page.getByRole('button', { name: /Send by Email/ }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page.locator('.toast')).toContainText('Awaiting administrator approval');
  await expect(page.getByRole('navigation')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('wannatalkApiToken'))).toBeNull();
});
for (const role of ['patient', 'provider', 'admin'] as Role[]) {
  test(`${role}: all pages, reload, and sidebar links`, async ({ page }) => {
    const api = await mockApi(page, role),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/${role}/${navigation[role][0].path}`);
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.locator('main .card').first()).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath(`${role}-overview.png`),
      fullPage: true,
      animations: 'disabled',
    });
    for (const item of navigation[role]) {
      await page
        .getByRole('navigation')
        .getByRole('button', { name: new RegExp(item.label) })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${role}/${item.path}$`));
      await expect(page.locator('main')).toBeVisible();
      await expect(page.getByText('Unable to display this page')).toHaveCount(0);
    }
    await page.reload();
    await expect(page.getByRole('navigation')).toBeVisible();
    expect(errors).toEqual([]);
    expect(api.unexpected).toEqual([]);
  });
}
test('MFA login rejects a bad code, verifies, and logs out', async ({ page }) => {
  await mockApi(page, 'patient', false);
  await page.goto('/login');
  await page.getByRole('button', { name: '👤 Patient' }).click();
  await page.getByLabel('Email', { exact: true }).fill('patient@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Login', exact: true }).last().click();
  await page.getByRole('button', { name: /Send by Email/ }).click();
  await page.getByLabel('Verification code').fill('111111');
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page.locator('.toast')).toHaveText('Incorrect verification code');
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page).toHaveURL(/patient\/book/);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/login/);
  expect(await page.evaluate(() => localStorage.getItem('wannatalkApiToken'))).toBeNull();
});
test('registration continues through contact verification', async ({ page }) => {
  const api = await mockApi(page, 'patient', false);
  await page.goto('/login');
  await page.getByRole('button', { name: '👤 Patient' }).click();
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await page.getByLabel('Title').selectOption('Ms.');
  await page.getByLabel('First Name').fill('New');
  await page.getByLabel('Last Name').fill('Patient');
  await page.getByLabel('Email', { exact: true }).fill('new@example.test');
  await page.getByLabel('Phone No. / Mobile').fill('+27 82 123 4567');
  await page.getByLabel('South African ID / Passport No.').fill('A12345678');
  await page.getByLabel('Date of Birth').fill('1990-05-12');
  await page.getByLabel('Send code via phone no.').check();
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page.getByLabel(/I accept the Patient Consent/).check();
  await page.getByLabel(/I accept the Terms and Conditions/).check();
  await page.getByLabel(/I accept the Privacy Policy/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Security verification' })).toBeVisible();
  const registration = api.requests.find((r) => r.path === '/auth/register')?.body;
  expect(registration).toMatchObject({
    fullName: 'New Patient',
    title: 'Ms.',
    firstName: 'New',
    lastName: 'Patient',
    identityDocument: 'A12345678',
    dateOfBirth: '1990-05-12',
    nationality: 'South Africa',
    otpMethod: 'sms',
    preferredContact: 'Email',
    patientConsentAccepted: true,
    termsAccepted: true,
    privacyAccepted: true,
  });
});
test('password reset link and forgot-password use the existing API', async ({ page }) => {
  const api = await mockApi(page, 'patient', false);
  await page.goto('/#reset=sample-token');
  await page.getByLabel('New password', { exact: true }).fill('new-password-123');
  await page.getByLabel('Confirm new password').fill('new-password-123');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
  expect(api.requests.find((r) => r.path === '/auth/reset-password')?.body.token).toBe(
    'sample-token',
  );
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByRole('button', { name: 'Send reset link' }).click();
  expect(api.requests.some((r) => r.path === '/auth/forgot-password')).toBe(true);
});
test('patient booking respects busy and blocked slots and supports calendar modes', async ({
  page,
}) => {
  const api = await mockApi(page, 'patient');
  await page.goto('/patient/book');
  await page.getByLabel('Practice location').selectOption('Online');
  await page.getByLabel('Appointment date').fill('2027-01-04');
  const monday = page
    .getByRole('button', { name: /10:00 – 11:00.*Dr Test Provider.*Not available/ })
    .first();
  await expect(monday).toBeDisabled();
  await expect(
    page.getByRole('button', { name: /12:00 – 13:00.*Not available/ }).first(),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: /09:00 – 10:00.*Available/ })
    .first()
    .click();
  await page.getByLabel('Note for provider').fill('Please call first');
  await page.getByRole('button', { name: 'Confirm Booking' }).click();
  await expect(page).toHaveURL(/patient\/appointments/);
  expect(
    api.requests.find((r) => r.path === '/appointments' && r.method === 'POST')?.body.mode,
  ).toBe('Online');
  await page.getByRole('button', { name: 'Month ›' }).click();
  await expect(page.locator('.month-board')).toBeVisible();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.locator('.day-shell')).toBeVisible();
});
test('booking details escape user text, show meeting link, and cancel through the API', async ({
  page,
}) => {
  const api = await mockApi(page, 'patient');
  await page.goto('/patient/appointments');
  await page
    .getByRole('row')
    .filter({ hasText: 'Booked' })
    .getByRole('button', { name: 'View', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('<img src=x');
  expect(
    await page.evaluate(() => (window as Window & { __unsafe?: boolean }).__unsafe),
  ).toBeUndefined();
  await expect(dialog.getByRole('link', { name: 'Join session' })).toHaveAttribute(
    'href',
    'https://example.test/session',
  );
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    api.requests.some(
      (r) => r.path === '/appointments/appointment-1/status' && r.body.status === 'Cancelled',
    ),
  ).toBe(true);
});
test('provider availability and patient profile persist via correct endpoints', async ({
  page,
}) => {
  const api = await mockApi(page, 'provider');
  await page.goto('/provider/availability');
  await page.getByLabel('Monday start').fill('08:30');
  await page.getByRole('button', { name: 'Save weekly availability' }).click();
  await expect(page.locator('.toast')).toHaveText('Availability saved to WannaTalk');
  expect(
    api.requests.some((r) => r.path === '/providers/provider-1/availability' && r.method === 'PUT'),
  ).toBe(true);
});
test('patient profile saves and survives a reload', async ({ page }) => {
  const api = await mockApi(page, 'patient');
  await page.goto('/patient/profile');
  await page.getByLabel('Name', { exact: true }).fill('Updated Patient');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.locator('.toast')).toHaveText('Profile saved');
  await page.reload();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Updated Patient');
  expect(api.requests.some((r) => r.path === '/patients/me' && r.method === 'PATCH')).toBe(true);
});
test('admin booking, registration approval and account editing', async ({ page }) => {
  const api = await mockApi(page, 'admin');
  await page.goto('/admin/appointments');
  await page.getByRole('button', { name: '＋ Create booking' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Patient', { exact: true }).selectOption('patient-1');
  await dialog.getByLabel('Provider', { exact: true }).selectOption('provider-1');
  await dialog.getByLabel('Location', { exact: true }).selectOption('online');
  await dialog.getByLabel('Appointment date').fill('2027-01-04');
  await dialog.getByLabel('Available time').selectOption('09:00');
  await dialog.getByRole('button', { name: 'Create booking', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/admin/registrations');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('No pending registration requests.')).toBeVisible();
  await page.goto('/admin/patients');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Full name').fill('Edited Patient');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('cell', { name: 'Edited Patient', exact: true })).toBeVisible();
  expect(api.unexpected).toEqual([]);
});
test('follow-up notes stay out of message payload and delivery history renders', async ({
  page,
}) => {
  const api = await mockApi(page, 'provider');
  await page.goto('/provider/followups');
  await page.getByRole('button', { name: '＋ Create follow-up' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Patient', { exact: true }).selectOption('patient-1');
  await dialog.getByLabel('Private internal note').fill('Confidential');
  await dialog.getByLabel('Patient reminder message').fill('Please arrange a session');
  await dialog.getByRole('button', { name: 'Save follow-up' }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/provider/messages');
  await page.getByLabel('Patient', { exact: true }).selectOption('patient-1');
  await page.getByLabel('Message', { exact: true }).fill('Hello patient');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('1 delivered');
  const sent = api.requests.find((r) => r.path === '/communications/send');
  expect(sent?.body).not.toHaveProperty('internalNote');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Hello patient');
});
test('waiting-list join, matching and notification', async ({ page }) => {
  const api = await mockApi(page, 'admin');
  await page.goto('/admin/waiting');
  await page.getByLabel('Patient', { exact: true }).selectOption('patient-1');
  await page.getByRole('button', { name: 'Add patient', exact: true }).click();
  await expect(page.locator('.toast')).toHaveText('Added to cancellation list');
  await page.getByLabel('Cancelled appointment').selectOption('cancelled-1');
  await page.getByRole('button', { name: 'Find matches' }).click();
  await page.getByRole('button', { name: 'Notify', exact: true }).first().click();
  await expect(page.locator('.toast')).toContainText('1 delivered');
  expect(api.unexpected).toEqual([]);
});
test('role guard, mobile drawer, and visual screenshots', async ({ page }) => {
  await mockApi(page, 'patient');
  await page.goto('/admin/registrations');
  await expect(page).toHaveURL(/patient\/book/);
  await expect(page.getByRole('heading', { name: 'Choose a location' })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('patient-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /My Profile/ })
    .click();
  await expect(page).toHaveURL(/patient\/profile/);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await page.locator('.sidebar').boundingBox())!.x)
    .toBeLessThan(-300);
  await page.screenshot({
    path: test.info().outputPath('patient-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
});
