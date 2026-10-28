import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { basename, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import puppeteer from 'puppeteer';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';

const defaultTemplatePath = fileURLToPath(
  process.env.NODE_ENV === 'production' ?
  new URL('../../frontend/invoice.html', import.meta.url) : new URL('../../frontend/public/invoice.html', import.meta.url)
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
  return Number(amount).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
}

function formatTime(value) {
  return String(value || '').slice(0, 5);
}

function formatDateOfBirth(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function fillPlaceholder(html, className, value) {
  const pattern = new RegExp(`(<span class="${className}">)[^<]*(</span>)`, 'g');
  return html.replace(pattern, (match, open, close) => `${open}${escapeHtml(value)}${close}`);
}

function fillImage(html, className, value) {
  const pattern = new RegExp(`(<img[^>]*class="${className}"[^>]*src=")[^"]*(")`, 'g');
  return html.replace(pattern, (match, open, close) => `${open}${escapeHtml(value || '')}${close}`);
}

async function embeddedLogo(value) {
  const logo = String(value || '');
  if (!logo.startsWith('/api/uploads/billing-logos/')) return logo;
  const filename = basename(logo);
  const extension = extname(filename).toLowerCase();
  const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : null;
  if (!mime) return '';
  try {
    const path = fileURLToPath(new URL(`../uploads/billing-logos/${filename}`, import.meta.url));
    return `data:${mime};base64,${(await readFile(path)).toString('base64')}`;
  } catch { return ''; }
}

/**
 * Reads the existing invoice template from frontend/public/invoice.html and
 * replaces only the dynamic placeholders (patient, provider and amount) with
 * escaped values. Everything else in the template is left untouched.
 */
export async function renderStoredInvoiceHtml(invoice) {
  const template = await readFile(templatePath(), 'utf8');
  for (const field of ['invoice-number', 'invoice-issued-date', 'invoice-patient-name', 'invoice-patient-summary', 'invoice-total']) {
    if (!template.includes(`class="${field}"`)) {
      const error = new Error(`Invoice template is missing the ${field} placeholder`);
      error.statusCode = 500;
      throw error;
    }
  }
  if (!template.includes('<!-- invoice-items -->')) {
    const error = new Error('Invoice template is missing the invoice-items placeholder');
    error.statusCode = 500;
    throw error;
  }
  const issuer=invoice.issuer_snapshot||{}, customer=invoice.customer_snapshot||{};
  const documentType=invoice.document_type==='Quote'?'Quote':'Invoice';
  const properCase = value => String(value||'').toLocaleLowerCase('en-ZA').replace(/(^|[\s'-])([\p{L}])/gu,(_,separator,letter)=>separator+letter.toLocaleUpperCase('en-ZA'));
  const rawDisplayName = customer.name || [String(invoice.patient_title || '').trim(), String(invoice.patient_name || '').trim()].filter(Boolean).join(' ');
  const displayName = customer.type === 'company' ? rawDisplayName : properCase(rawDisplayName);
  const summary = formatDateOfBirth(invoice.patient_date_of_birth);
  const patientSummary = [properCase(invoice.patient_name), formatDateOfBirth(invoice.patient_date_of_birth)].filter(Boolean).join(' ');
  const rows = invoice.items.map((item) => `<tr>
    <td><strong>${escapeHtml(formatDate(item.service_date||item.appointment_date))} ${escapeHtml(formatTime(item.appointment_time))}</strong><br><br><span class="code">${escapeHtml(item.tariff_code||'81305')}</span></td>
    <td class="desc"><div class="service-main">${escapeHtml(item.description||patientSummary)}</div>${item.provider_name?`<div class="service-sub">Provided by: ${escapeHtml(item.provider_name)}</div>`:''}</td>
    <td class="code">${escapeHtml(item.quantity||'1')}</td>
    <td class="code">${escapeHtml(item.document_number||invoice.invoice_number)}</td>
    <td class="amount">R ${escapeHtml(formatAmount(item.rate??item.amount))}</td>
    <td class="amount">R ${escapeHtml(formatAmount(item.amount))}</td>
  </tr>`).join('');
  let html = template;
  html=html.replace('<div class="doc-title">Invoice</div>',`<div class="doc-title">${documentType}</div>`);
  if(documentType==='Quote'){
    html=html.replace('<strong>Invoice No.:</strong>','<strong>Quote No.:</strong>');
    html=html.replace('<strong>Due:</strong>','<strong>Valid until:</strong>');
    html=html.replace('<th>Total due</th>','<th>Quote total</th>');
  }
  html = fillPlaceholder(html, 'invoice-number', invoice.invoice_number);
  html = fillPlaceholder(html, 'invoice-issued-date', formatDate(invoice.issue_date||invoice.issued_at));
  html = fillPlaceholder(html, 'invoice-due-date', formatDate(invoice.due_date));
  html = fillPlaceholder(html, 'invoice-patient-name', displayName);
  html = fillPlaceholder(html, 'invoice-patient-summary', summary);
  html = fillPlaceholder(html, 'invoice-total', `R ${formatAmount(invoice.total_amount)}`);
  html = fillPlaceholder(html, 'invoice-issuer-name', issuer.name||invoice.provider_name||'WannaTalk');
  html = fillPlaceholder(html, 'invoice-practice-number', issuer.practiceNumber ? `Practice No. ${issuer.practiceNumber}` : '');
  html = fillPlaceholder(html, 'invoice-issuer-address', issuer.address||'');
  html = fillPlaceholder(html, 'invoice-issuer-phone', issuer.phone||'');
  html = fillPlaceholder(html, 'invoice-issuer-email', issuer.email||'');
  html = fillPlaceholder(html, 'invoice-customer-details', [customer.address,customer.email,customer.phone].filter(Boolean).join('\n'));
  html = fillPlaceholder(html, 'invoice-bank-holder', issuer.bankAccountHolder||'Louw Alberts');
  html = fillPlaceholder(html, 'invoice-bank-name', issuer.bankName||'FNB');
  html = fillPlaceholder(html, 'invoice-bank-number', issuer.bankAccountNumber||'63191320620');
  html = fillPlaceholder(html, 'invoice-bank-type', issuer.bankAccountType||'CHEQUE ACCOUNT');
  html = fillPlaceholder(html, 'invoice-bank-branch', issuer.bankBranchCode||'');
  html = fillPlaceholder(html, 'invoice-remittance', issuer.remittanceInstructions||'Use the invoice number as your payment reference.');
  html = fillImage(html,'invoice-logo',await embeddedLogo(issuer.logoUrl));
  html = html.replace('</head>',`<style>:root{--invoice-brand:${/^#[0-9a-f]{6}$/i.test(issuer.brandPrimaryColor||'')?issuer.brandPrimaryColor:'#087b5b'}}</style></head>`);
  html = html.replace('<!-- invoice-items -->', rows);
  return html;
}

export async function renderInvoiceHtml({ patientTitle, patientName, patientDateOfBirth, providerName, amount }) {
  return renderStoredInvoiceHtml({
    invoice_number: 'Preview',
    issued_at: new Date().toISOString().slice(0, 10),
    patient_title: patientTitle,
    patient_name: patientName,
    patient_date_of_birth: patientDateOfBirth,
    total_amount: amount,
    items: [{
      appointment_date: new Date().toISOString().slice(0, 10),
      appointment_time: '',
      description: 'Professional consultation',
      mode: '',
      provider_name: providerName,
      amount,
    }],
  });
}

let browserPromise = null;

function chromeExecutablePath() {
  const configured = String(process.env.CHROME_EXECUTABLE_PATH || '').trim();
  if (configured) return configured;
  // Keep the direct Linux binary used by the systemd deployment.
  if (process.platform === 'linux') return '/opt/google/chrome/chrome';
  if (process.platform === 'win32') {
    const candidates = [
      process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
      process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
      process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    ];
    const installed = candidates.find((path) => path && existsSync(path));
    if (installed) return installed;
  }
  // Other local environments can use Puppeteer's downloaded browser.
  return puppeteer.executablePath();
}

async function launchBrowser() {
  // The systemd unit protects /home, so Chrome must not inherit the deploy
  // user's home/profile. A process-specific directory also avoids profile
  // locks when the service is restarted while an old Chrome is shutting down.
  const chromeHome = join(tmpdir(), `wannatalk-chrome-${process.pid}`);
  const userDataDir = join(chromeHome, 'profile');
  const cacheDir = join(chromeHome, 'cache');
  const configDir = join(chromeHome, 'config');
  const dataDir = join(chromeHome, 'data');
  const crashDir = join(chromeHome, 'crashpad');
  await Promise.all(
    [userDataDir, cacheDir, configDir, dataDir, crashDir].map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  );

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--disable-breakpad',
    '--disable-crash-reporter',
    '--disable-crashpad',
    '--disable-features=Crashpad',
    '--password-store=basic',
    '--use-mock-keychain',
    `--crash-dumps-dir=${crashDir}`,
    `--user-data-dir=${userDataDir}`,
  ];
  const env = {
    ...process.env,
    HOME: chromeHome,
    XDG_CACHE_HOME: cacheDir,
    XDG_CONFIG_HOME: configDir,
    XDG_DATA_HOME: dataDir,
  };

  return puppeteer.launch({
    // google-chrome is a shell wrapper which invokes xdg-settings and touches
    // /home. Launch the real binary directly under a hardened systemd unit.
    executablePath: chromeExecutablePath(),
    headless: true,
    args,
    env,
  });
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

export async function generateStoredInvoicePdf(invoice) {
  const html = await renderStoredInvoiceHtml(invoice);
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

export async function generateHtmlPdf(html) {
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    try {
      await page.setJavaScriptEnabled(false);
      await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
      return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
    } finally {
      await page.close().catch(() => {});
    }
  });
}

export async function passwordProtectPdf(pdfBuffer, password) {
  const userPassword = String(password || '').trim();
  if (!userPassword) throw new Error('A PDF password is required');
  const encrypted = await encryptPDF(new Uint8Array(pdfBuffer), userPassword, {
    ownerPassword: randomBytes(32).toString('base64url'),
    algorithm: 'AES-256',
    allowPrinting: true,
    allowHighQualityPrint: true,
    allowCopying: false,
    allowModifying: false,
    allowAnnotating: false,
    allowFillingForms: false,
    allowAssembly: false,
    allowExtraction: true,
  });
  return Buffer.from(encrypted);
}
