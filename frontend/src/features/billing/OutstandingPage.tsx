import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Empty, Heading, StatusPill } from '../../components/ui';
import { api } from '../../services/api';
import BillingNav from './BillingNav';

interface Invoice {
  id: string; invoice_number: string; patient_name: string; provider_name: string;
  company_name: string | null; appointment_date: string | null; appointment_time: string | null;
  due_date: string; outstanding_balance: number; status: string;
}
const money = (value: number) => `R ${Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OutstandingPage() {
  const { notify } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const load = () => api<{ invoices: Invoice[] }>('/invoices')
    .then(result => setInvoices(result.invoices.filter(i => i.outstanding_balance > 0 && !['Void', 'Credited'].includes(i.status))))
    .catch(error => notify(error instanceof Error ? error.message : 'Unable to load outstanding invoices'))
    .finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  const total = useMemo(() => invoices.reduce((sum, invoice) => sum + invoice.outstanding_balance, 0), [invoices]);
  async function send(invoice: Invoice) {
    setSending(true);
    try {
      const result = await api<{ message: string }>(`/invoices/${invoice.id}/email`, { method: 'POST' });
      setSent(current => [...current, invoice.id]);
      notify(result.message || `Invoice ${invoice.invoice_number} emailed`);
    } catch (error) { notify(error instanceof Error ? error.message : `Unable to email ${invoice.invoice_number}`); }
    finally { setSending(false); }
  }
  async function sendAll() {
    setSending(true);
    let success = 0;
    const failures: string[] = [];
    for (const invoice of invoices) {
      try {
        await api(`/invoices/${invoice.id}/email`, { method: 'POST' });
        success++;
        setSent(current => current.includes(invoice.id) ? current : [...current, invoice.id]);
      } catch { failures.push(invoice.invoice_number); }
    }
    notify(`${success} outstanding invoice${success === 1 ? '' : 's'} emailed${failures.length ? `. Could not email: ${failures.join(', ')}` : ''}`);
    setSending(false);
  }
  return <section className="billing-dashboard">
    <Heading title="Outstanding payments" subtitle="Review unpaid invoice balances and email the billing contact a copy of each invoice." />
    <BillingNav />
    <Card>
      <div className="section-title"><div><h3>Unpaid invoices</h3><p className="sub">{invoices.length} invoice{invoices.length === 1 ? '' : 's'} · {money(total)} outstanding</p></div>
        <button className="btn" disabled={sending || !invoices.length} onClick={() => void sendAll()}>{sending ? 'Sending…' : 'Email all outstanding invoices'}</button>
      </div>
      {loading ? <p>Loading outstanding invoices…</p> : invoices.length ? <div className="dashboard-table"><table><thead><tr><th>Invoice</th><th>Patient / billing party</th><th>Provider</th><th>Appointment</th><th>Due date</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {invoices.map(invoice => <tr key={invoice.id}><td><strong>{invoice.invoice_number}</strong></td><td>{invoice.company_name || invoice.patient_name}{invoice.company_name && <div className="sub">Patient: {invoice.patient_name}</div>}</td><td>{invoice.provider_name}</td><td>{invoice.appointment_date || '—'}{invoice.appointment_time && <div className="sub">{invoice.appointment_time.slice(0, 5)}</div>}</td><td>{invoice.due_date}</td><td>{money(invoice.outstanding_balance)}</td><td><StatusPill status={invoice.status} /></td><td><button className="btn secondary small" disabled={sending} onClick={() => void send(invoice)}>{sent.includes(invoice.id) ? 'Send again' : 'Email invoice'}</button></td></tr>)}
      </tbody></table></div> : <Empty>No outstanding invoice balances.</Empty>}
    </Card>
  </section>;
}
