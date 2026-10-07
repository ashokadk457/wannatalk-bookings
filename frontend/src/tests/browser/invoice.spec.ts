import { test, expect } from '@playwright/test';
import { appointmentDate, mockApi } from './fixtures';

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
  await page.getByLabel(`Amount for ${appointmentDate}`).fill('-5');
  await dialog.getByRole('button', { name: 'Create Invoice' }).click();
  await expect(page.locator('.toast')).toHaveText('Enter a valid amount greater than 0 for every selected appointment');
  await expect(dialog).toBeVisible();

  // a valid decimal amount opens the invoice in a new tab
  await page.getByLabel(`Amount for ${appointmentDate}`).fill('250.5');
  const popupPromise = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Create Invoice' }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/invoice\.html\?invoiceId=invoice-1/);
  expect(popup.url()).toContain('/invoice.html?invoiceId=invoice-1');
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
  await page.goto('/invoice.html?invoiceId=invoice-1');
  await expect(page.locator('.invoice-patient-name')).toHaveText('Mr Test Patient');
  await expect(page.locator('.invoice-patient-summary')).toHaveText('Test Patient · 15/12/1969');
  await expect(page.locator('#invoiceItems')).toContainText('Dr Test Provider');
  await expect(page.locator('#invoiceItems')).toContainText('81305');
  await expect(page.locator('#invoiceItems')).toContainText('Z71.9');
  await expect(page.locator('#invoiceItems')).toContainText('00004510');
  await expect(page.locator('#invoiceItems')).toContainText('Seen by: Dr Test Provider');
  await expect(page.locator('#invoiceItems')).toContainText('Assessment, consultation, counselling and/or therapy (individual)');
  await expect(page.locator('.invoice-total')).toHaveText('R 250,50');
  await expect(page.locator('.bank-box')).toContainText('Louw Alberts Psychology Practice');
  await expect(page.locator('.bank-box')).toContainText('First National Bank (FNB)');
  await expect(page.locator('.bank-box')).toContainText('63191320620');
  await expect(page.locator('.bank-box')).toContainText('Cheque Account');
  await expect(page.locator('.bank-box')).toContainText('WT-2027-000001');
  await expect(page.locator('.address-box')).toContainText('309 Friederiche Street');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('WT-2027-000001.pdf');

  await page.getByRole('button', { name: 'Email Invoice' }).click();
  await expect(page.locator('#invoiceStatus')).toHaveText('Invoice WT-2027-000001 emailed successfully.');
  await expect(page.getByRole('button', { name: 'Email Invoice' })).toBeEnabled();
});
