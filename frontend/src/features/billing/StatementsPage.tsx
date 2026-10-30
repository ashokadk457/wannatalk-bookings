import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Empty, Field, Heading } from '../../components/ui';
import { api } from '../../services/api';
import BillingNav from './BillingNav';
interface Company {
  id: string;
  registered_name: string;
  is_active: boolean;
}
interface Tx {
  date: string;
  type: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  status: string;
}
interface Statement {
  provider: { registered_business_name: string | null; full_name: string };
  customer: { name: string; email: string | null; phone: string | null };
  customerType: string;
  from: string;
  to: string;
  openingBalance: number;
  transactions: Tx[];
  closingBalance: number;
}
const money = (x: number) =>
  `R ${Number(x).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const first = () =>
  new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA');
const today = () => new Date().toLocaleDateString('en-CA');
export default function StatementsPage() {
  const { data, notify, user } = useApp();
  const providerMode = user?.role === 'provider';
  const [providerId, setProvider] = useState(providerMode ? user?.entityId || '' : ''),
    [type, setType] = useState('patient'),
    [customerId, setCustomer] = useState(''),
    [from, setFrom] = useState(first()),
    [to, setTo] = useState(today()),
    [companies, setCompanies] = useState<Company[]>([]),
    [statement, setStatement] = useState<Statement | null>(null),
    [loading, setLoading] = useState(false),
    [sending, setSending] = useState(false),
    [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  useEffect(() => {
    if (providerMode) setProvider(user?.entityId || '');
  }, [providerMode, user?.entityId]);
  useEffect(() => {
    if (!providerMode)
      api<{ companies: Company[] }>('/billing/companies')
        .then((x) => setCompanies(x.companies.filter((c) => c.is_active)))
        .catch(() => setCompanies([]));
  }, [providerMode]);
  const params = () =>
    new URLSearchParams({ providerId, customerType: type, customerId, from, to });
  async function generate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api<{ statement: Statement }>(`/billing/statements?${params()}`);
      setStatement(result.statement);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to generate statement');
    } finally {
      setLoading(false);
    }
  }
  async function download() {
    try {
      const response = await fetch(`/api/billing/statements/pdf?${params()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('wannatalkApiToken') || ''}` },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || 'Unable to generate statement PDF');
      }
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement('a');
      link.href = url;
      link.download = `statement-${from}-${to}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      const method = response.headers.get('X-Statement-Password-Method');
      notify(
        method === 'phone-last-6'
          ? 'PDF downloaded. Use the last 6 digits of the billing account phone number to open it.'
          : method === 'identity-document'
            ? "PDF downloaded. Use the patient's full ID or passport number to open it."
            : 'PDF downloaded. Use the full ID/passport number, or the last 6 phone digits when no ID is saved.',
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to download statement');
    }
  }
  async function email() {
    setSending(true);
    try {
      const result = await api<{ message: string }>('/billing/statements/email', {
        method: 'POST',
        body: JSON.stringify({ providerId, customerType: type, customerId, from, to }),
      });
      notify(result.message);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to email statement');
    } finally {
      setSending(false);
    }
  }
  async function whatsapp() {
    setSendingWhatsApp(true);
    try {
      const result = await api<{ message: string }>('/billing/statements/whatsapp', {
        method: 'POST',
        body: JSON.stringify({ providerId, customerType: type, customerId, from, to }),
      });
      notify(result.message);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to send statement by WhatsApp');
    } finally {
      setSendingWhatsApp(false);
    }
  }
  return (
    <section>
      <Heading
        title="Statements"
        subtitle="Create a complete account statement with invoices, payments, credits and balances."
      />
      <BillingNav />
      <Card>
        <form className="statement-filters" onSubmit={generate}>
          {!providerMode && (
            <Field label="Provider">
              <select required value={providerId} onChange={(e) => setProvider(e.target.value)}>
                <option value="">Select provider</option>
                {data.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {!providerMode && (
            <Field label="Financially responsible party type">
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setCustomer('');
                }}
              >
                <option value="patient">Patient</option>
                <option value="company">Financially Responsible Party</option>
              </select>
            </Field>
          )}
          <Field label={type === 'company' ? 'Financially Responsible Party' : 'Patient'}>
            <select required value={customerId} onChange={(e) => setCustomer(e.target.value)}>
              <option value="">Select account</option>
              {type === 'company'
                ? companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.registered_name}
                    </option>
                  ))
                : data.patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
            </select>
          </Field>
          <Field label="From">
            <input required type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input
              required
              type="date"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <button className="btn" disabled={loading}>
            {loading ? 'Generating…' : 'Generate statement'}
          </button>
        </form>
      </Card>
      {statement && (
        <Card>
          <div className="statement-document">
            <header>
              <div>
                <span className="eyebrow">Account statement</span>
                <h2>
                  {statement.provider.registered_business_name || statement.provider.full_name}
                </h2>
                <p>{statement.customer.name}</p>
              </div>
              <div className="statement-period">
                <span>Period</span>
                <strong>
                  {statement.from} — {statement.to}
                </strong>
              </div>
            </header>
            <div className="statement-opening">
              <span>Opening balance</span>
              <strong>{money(statement.openingBalance)}</strong>
            </div>
            {statement.transactions.length ? (
              <div className="dashboard-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Transaction</th>
                      <th>Reference</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.transactions.map((x, index) => (
                      <tr key={`${x.date}-${x.reference}-${index}`}>
                        <td>{x.date}</td>
                        <td>
                          {x.type}
                          <div className="sub">{x.status}</div>
                        </td>
                        <td>{x.reference}</td>
                        <td>{x.debit ? money(x.debit) : '—'}</td>
                        <td>{x.credit ? money(x.credit) : '—'}</td>
                        <td>
                          <strong>{money(x.balance)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No transactions occurred during this period.</Empty>
            )}
            <footer>
              <span>Closing balance</span>
              <strong>{money(statement.closingBalance)}</strong>
            </footer>
            <div className="notice statement-password-guidance">
              <strong>Password-protected PDF</strong>
              <span>
                {type === 'company'
                  ? 'Open the PDF with the last 6 digits of the billing account phone number.'
                  : "Open the PDF with the patient's full ID/passport number. If no ID or passport is saved, use the last 6 digits of the billing account phone number."}{' '}
                The password is never included in the email.
              </span>
            </div>
            <div className="statement-actions">
              <button className="btn secondary" type="button" onClick={() => window.print()}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M6 9V3h12v6h1a3 3 0 0 1 3 3v6h-4v3H6v-3H2v-6a3 3 0 0 1 3-3h1zm2-4v4h8V5H8zm8 10H8v4h8v-4zm3-4H5a1 1 0 0 0-1 1v4h2v-3h12v3h2v-4a1 1 0 0 0-1-1zm-1 1.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" />
                </svg>
                Print preview
              </button>
              <button className="btn secondary" type="button" onClick={() => void download()}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M11 3h2v10.2l3.6-3.6L18 11l-6 6-6-6 1.4-1.4 3.6 3.6V3zM4 19h16v2H4z" />
                </svg>
                Download PDF
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => void email()}
                disabled={sending || !statement.customer.email}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm9 7.2L20.2 7H3.8l8.2 5.2zM3 17h18V9.3l-9 5.7-9-5.7V17z" />
                </svg>
                {sending ? 'Emailing…' : 'Email statement'}
              </button>
              <button
                className="btn statement-whatsapp-button"
                type="button"
                onClick={() => void whatsapp()}
                disabled={sendingWhatsApp || !statement.customer.phone}
              >
                <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
                  <path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4a10.6 10.6 0 1 1 9.3 5zm5.8-8c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.8.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-2-.8-3.4-1.8-4.5-3.8-.3-.5.3-.5.9-1.6.1-.2.1-.4 0-.6l-1-2.4c-.3-.6-.6-.5-.8-.5h-.7c-.2 0-.6.1-.9.4-1 1-1.4 2.2-1.4 3.6 0 2.1 1.5 4.1 1.7 4.4.2.3 3 4.7 7.4 6.4 2.7 1.1 3.8 1.2 5.1.9 1.2-.2 1.9-1 2.2-1.9.3-.9.3-1.6.2-1.8-.1-.2-.3-.3-.6-.5z" />
                </svg>
                {sendingWhatsApp ? 'Sending…' : 'Send via WhatsApp'}
              </button>
            </div>
            {!statement.customer.email && (
              <p className="form-help">
                Add an email address to this billing account before sending the statement.
              </p>
            )}
            {!statement.customer.phone && (
              <p className="form-help">
                Add a phone number to this billing account before sending by WhatsApp.
              </p>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
