import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const defaultTemplatePath = fileURLToPath(
  new URL('../../frontend/public/invoice.html', import.meta.url),
);

function templatePath() {
  const configured = String(process.env.INVOICE_TEMPLATE_PATH || '').trim();
  return configured || defaultTemplatePath;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

/**
 * Validates an invoice amount coming from the admin UI. Accepts numbers and
 * numeric strings, rejects empty/NaN/negative values and rounds to cents.
 * Returns null when the value is not a valid invoice amount.
 */
export function parseInvoiceAmount(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function formatAmount(amount) {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateOfBirth(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function fillPlaceholder(html, className, value) {
  const pattern = new RegExp(`(<span class="${className}">)[^<]*(</span>)`, 'g');
  return html.replace(pattern, (match, open, close) => `${open}${escapeHtml(value)}${close}`);
}

/**
 * Reads the existing invoice template from frontend/public/invoice.html and
 * replaces only the dynamic placeholders (patient, provider and amount) with
 * escaped values. Everything else in the template is left untouched.
 */
export async function renderInvoiceHtml({ patientTitle, patientName, patientDateOfBirth, providerName, amount }) {
  const template = await readFile(templatePath(), 'utf8');
  for (const field of ['invoice-patient-name', 'invoice-patient-summary', 'invoice-provider-name', 'invoice-amount']) {
    if (!template.includes(`class="${field}"`)) {
      const error = new Error(`Invoice template is missing the ${field} placeholder`);
      error.statusCode = 500;
      throw error;
    }
  }
  const displayName = [String(patientTitle || '').trim(), String(patientName || '').trim()].filter(Boolean).join(' ');
  const summary = [String(patientName || '').trim(), formatDateOfBirth(patientDateOfBirth)].filter(Boolean).join(' ');
  let html = template;
  html = fillPlaceholder(html, 'invoice-patient-name', displayName);
  html = fillPlaceholder(html, 'invoice-patient-summary', summary);
  html = fillPlaceholder(html, 'invoice-provider-name', String(providerName || '').trim());
  html = fillPlaceholder(html, 'invoice-amount', formatAmount(amount));
  return html;
}

let browserPromise = null;

async function launchBrowser() {
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  try {
    return await puppeteer.launch({ args });
  } catch (error) {
    // The bundled Chromium download is disabled for this project, so fall back
    // to an installed system Chrome/Edge when the bundled browser is missing.
    return await puppeteer.launch({ channel: 'chrome', args });
  }
}

async function withBrowser(work) {
  if (!browserPromise) browserPromise = launchBrowser();
  try {
    const browser = await browserPromise;
    return await work(browser);
  } catch (error) {
    // Drop the cached browser so the next request starts from a clean state.
    const failed = browserPromise;
    browserPromise = null;
    await failed.then((browser) => browser.close()).catch(() => {});
    throw error;
  }
}

/**
 * Renders the existing invoice HTML template with dynamic values and converts
 * it to a PDF using the project's puppeteer dependency. JavaScript is disabled
 * during rendering (values are already filled server side) and the print
 * stylesheet hides the on-screen Download/Email toolbar, so the buttons never
 * appear inside the PDF.
 */
export async function generateInvoicePdf({ patientTitle, patientName, patientDateOfBirth, providerName, amount }) {
  const html = await renderInvoiceHtml({ patientTitle, patientName, patientDateOfBirth, providerName, amount });
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    try {
      await page.setJavaScriptEnabled(false);
      await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => {});
    }
  });
}