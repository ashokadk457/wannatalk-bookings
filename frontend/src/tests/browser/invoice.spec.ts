import { test, expect } from '@playwright/test';
import { mockApi } from './fixtures';

test('admin can generate an invoice with a validated amount', async ({ page }) => {
  const api = await mockApi(page, 'admin');
  await page.goto('/admin/appointments');
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'Generate Invoice' }) })
    .first();
  await row.getByRole('button', { name: 'Generate Invoice' }).click();
  const dialog = page.getByRole('dialog');

  // invalid amounts are rejected and no invoice tab is opened
  await page.getByLabel('Invoice Amount').fill('-5');
  await dialog.getByRole('button', { name: 'Generate Invoice' }).click();
  await expect(page.locator('.toast')).toHaveText('Enter a valid invoice amount greater than 0');
  await expect(dialog).toBeVisible();

  // a valid decimal amount opens the invoice in a new tab
  await page.getByLabel('Invoice Amount').fill('250.5');
  const popupPromise = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Generate Invoice' }).click();
  const popup = await popupPromise;
  expect(popup.url()).toContain('/invoice.html?appointmentId=appointment-1&amount=250.50');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(api.unexpected).toEqual([]);
});

test('invoice button is not shown to non-admin users', async ({ page }) => {
  await mockApi(page, 'patient');
  await page.goto('/patient/appointments');
  await expect(page.getByRole('button', { name: 'Generate Invoice' })).toHaveCount(0);
});

test('invoice page fills dynamic values and supports download and email', async ({ page }) => {
  await mockApi(page, 'admin');
  await page.goto('/invoice.html?appointmentId=appointment-1&amount=250.50');
  await expect(page.locator('.invoice-patient-name')).toHaveText('Mr Test Patient');
  await expect(page.locator('.invoice-patient-summary')).toHaveText('Test Patient 15/12/1969');
  await expect(page.locator('.invoice-provider-name')).toHaveText('Dr Test Provider');
  await expect(page.locator('.invoice-amount').first()).toHaveText('250.50');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('invoice-appointment-1.pdf');

  await page.getByRole('button', { name: 'Email Invoice' }).click();
  await expect(page.locator('#invoiceStatus')).toHaveText('Invoice emailed successfully.');
  await expect(page.getByRole('button', { name: 'Email Invoice' })).toBeEnabled();
});
