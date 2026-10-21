import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Empty, Field, Heading, StatusPill } from '../../components/ui';
import { api, mutate } from '../../services/api';
import BillingNav from './BillingNav';
import { InvoiceEditor, type Invoice as EditorInvoice } from './InvoiceEditor';
import Modal from '../../components/Modal';

interface Invoice extends EditorInvoice {
  payments_received: number;
  billing_review: boolean;
  billing_review_reason: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  service: string | null;
  appointments_cancelled: boolean;
}
interface DeletedInvoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  total_amount: number;
  payments_received: number;
  outstanding_balance: number;
  status_before_delete: string;
  deleted_at: string;
  deleted_by_name: string;
  deletion_reason: string;
  billing_customer_type: string;
  patient_name: string;
  provider_name: string;
  company_name: string | null;
}
interface Summary {
  invoice_count: number;
  invoiced: string;
  paid_count: number;
  paid: string;
  due_count: number;
  due_amount: string;
  overdue_count: number;
  overdue_amount: string;
  partially_paid_count: number;
  partially_paid_amount: string;
  credited_count: number;
  credited_amount: string;
  billing_review_count: number;
  billing_review_amount: string;
}
interface Overview {
  summary: Summary;
  overdue: {
    id: string;
    invoice_number: string;
    patient_name: string;
    appointment_date: string | null;
    outstanding_balance: number;
    days_overdue: number;
  }[];
  upcoming: {
    appointment_id: string;
    appointment_date: string;
    appointment_time: string;
    payment_status: string;
    patient_name: string;
    provider_name: string;
    invoice_id: string | null;
    invoice_number: string | null;
    total_amount: number;
    outstanding_balance: number;
    status: string | null;
    billing_review: boolean;
  }[];
  credits: {
    id: string;
    credit_note_number: string;
    invoice_id: string;
    invoice_number: string;
    patient_name: string;
    amount: number;
    reason: string;
    credit_date: string;
  }[];
}
const money = (value: string | number) =>
  `R ${Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const displayStatus = (invoice: Invoice) =>
  invoice.billing_review
    ? 'Billing review'
    : invoice.status === 'Issued'
      ? 'Due'
      : invoice.status === 'Part Paid'
        ? 'Partially paid'
        : invoice.status;
const openInvoice = (id: string) =>
  window.open(`/invoice.html?invoiceId=${encodeURIComponent(id)}`, '_blank');
type OverviewPanel = 'overdue' | 'upcoming' | 'credits';

function OverviewModal({
  panel,
  overview,
  onClose,
}: {
  panel: OverviewPanel;
  overview: Overview;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1),
    pageSize = 10;
  const rows = overview[panel],
    pageCount = Math.max(1, Math.ceil(rows.length / pageSize)),
    visible = rows.slice((page - 1) * pageSize, page * pageSize);
  const title =
    panel === 'overdue'
      ? 'All overdue invoices'
      : panel === 'upcoming'
        ? 'All upcoming appointments without an invoice'
        : 'All recent credit notes';
  return (
    <Modal title={title} className="billing-overview-dialog" onClose={onClose}>
      <div className="dashboard-table billing-overview-modal-table">
        <table>
          <thead>
            <tr>
              {panel === 'overdue' ? (
                <>
                  <th>Invoice</th>
                  <th>Patient</th>
                  <th>Appointment</th>
                  <th>Balance</th>
                  <th>Days</th>
                </>
              ) : panel === 'upcoming' ? (
                <>
                  <th>Date / time</th>
                  <th>Patient</th>
                  <th>Provider</th>
                  <th>Amount</th>
                  <th>Status</th>
                </>
              ) : (
                <>
                  <th>Credit note</th>
                  <th>Invoice</th>
                  <th>Patient</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Date</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {panel === 'overdue' &&
              (visible as Overview['overdue']).map((x) => (
                <tr key={x.id}>
                  <td>
                    <button className="link-button" onClick={() => openInvoice(x.id)}>
                      {x.invoice_number}
                    </button>
                  </td>
                  <td>{x.patient_name}</td>
                  <td>{x.appointment_date || '—'}</td>
                  <td>{money(x.outstanding_balance)}</td>
                  <td>{x.days_overdue}</td>
                </tr>
              ))}
            {panel === 'upcoming' &&
              (visible as Overview['upcoming']).map((x) => (
                <tr key={x.appointment_id}>
                  <td>
                    {x.appointment_date}
                    <div className="sub">{x.appointment_time.slice(0, 5)}</div>
                  </td>
                  <td>{x.patient_name}</td>
                  <td>{x.provider_name}</td>
                  <td>—</td>
                  <td>
                    <StatusPill status={x.payment_status || 'Unpaid'} />
                  </td>
                </tr>
              ))}
            {panel === 'credits' &&
              (visible as Overview['credits']).map((x) => (
                <tr key={x.id}>
                  <td>{x.credit_note_number}</td>
                  <td>
                    <button className="link-button" onClick={() => openInvoice(x.invoice_id)}>
                      {x.invoice_number}
                    </button>
                  </td>
                  <td>{x.patient_name}</td>
                  <td>{money(x.amount)}</td>
                  <td>{x.reason}</td>
                  <td>{x.credit_date}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="pagination-controls">
        <span>
          Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} of{' '}
          {rows.length}
        </span>
        <div className="actions">
          <button
            type="button"
            className="btn secondary small"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span className="pill">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            className="btn secondary small"
            disabled={page === pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function InvoicesPage() {
  const { notify } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>([]),
    [deletedInvoices, setDeletedInvoices] = useState<DeletedInvoice[]>([]),
    [overview, setOverview] = useState<Overview | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [creating, setCreating] = useState(false),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('All'),
    [provider, setProvider] = useState('All'),
    [patient, setPatient] = useState('All'),
    [company, setCompany] = useState('All'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(25),
    [invoiceView, setInvoiceView] = useState<'active' | 'deleted'>('active'),
    [openPanel, setOpenPanel] = useState<OverviewPanel | null>(null);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [invoiceResult, deletedResult, overviewResult] = await Promise.all([
        api<{ invoices: Invoice[] }>('/invoices'),
        api<{ invoices: DeletedInvoice[] }>('/invoices/deleted'),
        api<Overview>('/billing/overview'),
      ]);
      setInvoices(invoiceResult.invoices.filter((x) => !x.appointments_cancelled));
      setDeletedInvoices(deletedResult.invoices);
      setOverview(overviewResult);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to load billing data';
      setError(message);
      notify(message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const providers = useMemo(
    () => [...new Set(invoices.map((x) => x.provider_name).filter(Boolean))].sort(),
    [invoices],
  );
  const patients = useMemo(
    () => [...new Set(invoices.map((x) => x.patient_name).filter(Boolean))].sort(),
    [invoices],
  );
  const companies = useMemo(
    () =>
      [
        ...new Set(invoices.map((x) => x.company_name).filter((x): x is string => Boolean(x))),
      ].sort(),
    [invoices],
  );
  const rows = useMemo(
    () =>
      invoices.filter((x) => {
        const hay =
          `${x.invoice_number} ${x.patient_name} ${x.provider_name} ${x.company_name || ''}`.toLowerCase();
        const shown = displayStatus(x);
        return (
          hay.includes(search.toLowerCase()) &&
          (status === 'All' || shown === status) &&
          (provider === 'All' || x.provider_name === provider) &&
          (patient === 'All' || x.patient_name === patient) &&
          (company === 'All' || x.company_name === company) &&
          (!from || x.issue_date >= from) &&
          (!to || x.issue_date <= to)
        );
      }),
    [invoices, search, status, provider, patient, company, from, to],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize)),
    currentPage = Math.min(page, pageCount),
    visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [search, status, provider, patient, company, from, to]);
  const clear = () => {
    setSearch('');
    setStatus('All');
    setProvider('All');
    setPatient('All');
    setCompany('All');
    setFrom('');
    setTo('');
    setPage(1);
  };
  const removeInvoice = async (invoice: Invoice) => {
    const reason = window.prompt(
      `Why are you deleting invoice ${invoice.invoice_number}? This reason will be kept in the deletion history.`,
    );
    if (reason === null) return;
    if (!reason.trim()) {
      notify('Enter a reason for deleting this invoice');
      return;
    }
    if (
      !window.confirm(
        `Delete invoice ${invoice.invoice_number}? It will remain in deleted history.`,
      )
    ) {
      return;
    }
    try {
      await mutate(`/invoices/${invoice.id}`, 'DELETE', { reason: reason.trim() });
      notify(`Invoice ${invoice.invoice_number} moved to deleted history`);
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to delete invoice');
    }
  };
  const cards = overview
    ? ([
        ['Invoices issued', overview.summary.invoice_count, overview.summary.invoiced, 'All'],
        ['Paid', overview.summary.paid_count, overview.summary.paid, 'Paid'],
        ['Due', overview.summary.due_count, overview.summary.due_amount, 'Due'],
        ['Overdue', overview.summary.overdue_count, overview.summary.overdue_amount, 'Overdue'],
        [
          'Partially paid',
          overview.summary.partially_paid_count,
          overview.summary.partially_paid_amount,
          'Partially paid',
        ],
        [
          'Credit notes',
          overview.summary.credited_count,
          overview.summary.credited_amount,
          'Credited',
        ],
        [
          'Billing review',
          overview.summary.billing_review_count,
          overview.summary.billing_review_amount,
          'Billing review',
        ],
      ] as const)
    : [];
  return (
    <section className="billing-dashboard">
      <div className="billing-page-head">
        <Heading
          title="Billing"
          subtitle="Invoices, payment status, credits and exceptions across the practice."
        />
        {invoiceView === 'active' && (
          <button className="btn" disabled={Boolean(error)} onClick={() => setCreating(true)}>
            + Create invoice
          </button>
        )}
      </div>
      <BillingNav />
      <nav className="workflow-tabs" aria-label="Invoice views">
        <button
          className={invoiceView === 'active' ? 'active' : ''}
          onClick={() => setInvoiceView('active')}
        >
          Active invoices
        </button>
        <button
          className={invoiceView === 'deleted' ? 'active' : ''}
          onClick={() => setInvoiceView('deleted')}
        >
          Deleted invoices{' '}
          <span aria-label={`${deletedInvoices.length} deleted invoices`}>
            ({deletedInvoices.length})
          </span>
        </button>
      </nav>
      {error ? (
        <Card>
          <p className="billing-load-error" role="alert">
            Financial status unavailable. Invoice creation is disabled until billing data loads.
          </p>
          <button className="btn secondary" onClick={() => void load()}>
            Retry
          </button>
        </Card>
      ) : (
        <>
          {invoiceView === 'active' && (
            <div className="billing-kpi-grid">
              {cards.map(([label, count, amount, filter]) => (
                <button
                  key={label}
                  className={`billing-kpi ${status === filter ? 'selected' : ''}`}
                  onClick={() => setStatus(filter)}
                >
                  <span>{label}</span>
                  <strong>{count}</strong>
                  <small>{money(amount)}</small>
                </button>
              ))}
            </div>
          )}
          {invoiceView === 'active' && (
            <Card className="billing-invoice-card">
              <div className="billing-filter-grid">
                <Field label="Search">
                  <input
                    type="search"
                    placeholder="Invoice, patient or provider"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </Field>
                <Field label="Status">
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {[
                      'All',
                      'Due',
                      'Partially paid',
                      'Paid',
                      'Overdue',
                      'Credited',
                      'Billing review',
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Provider">
                  <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                    <option>All</option>
                    {providers.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Patient">
                  <select value={patient} onChange={(e) => setPatient(e.target.value)}>
                    <option>All</option>
                    {patients.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Company">
                  <select value={company} onChange={(e) => setCompany(e.target.value)}>
                    <option>All</option>
                    {companies.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="From">
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label="To">
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
                <button className="btn secondary" onClick={clear}>
                  Clear
                </button>
              </div>
              {loading ? (
                <p>Loading invoices…</p>
              ) : rows.length ? (
                <>
                  <div className="dashboard-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Invoice no</th>
                          <th>Date issued</th>
                          <th>Patient / party</th>
                          <th>Provider</th>
                          <th>Appointment</th>
                          <th>Service</th>
                          <th>Amount</th>
                          <th>Paid</th>
                          <th>Balance</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((x) => (
                          <tr key={x.id}>
                            <td>
                              <button className="link-button" onClick={() => openInvoice(x.id)}>
                                {x.invoice_number}
                              </button>
                            </td>
                            <td>{x.issue_date}</td>
                            <td>
                              {x.company_name || x.patient_name}
                              {x.company_name && (
                                <div className="sub">Patient: {x.patient_name}</div>
                              )}
                            </td>
                            <td>{x.provider_name}</td>
                            <td>
                              {x.appointment_date || '—'}
                              {x.appointment_time && (
                                <div className="sub">{x.appointment_time.slice(0, 5)}</div>
                              )}
                            </td>
                            <td>{x.service || 'Professional service'}</td>
                            <td>{money(x.total_amount)}</td>
                            <td>{money(x.payments_received)}</td>
                            <td>{money(x.outstanding_balance)}</td>
                            <td>
                              <StatusPill status={displayStatus(x)} />
                              {x.billing_review_reason && (
                                <div className="sub">{x.billing_review_reason}</div>
                              )}
                            </td>
                            <td>
                              <div className="actions">
                                <button
                                  className="btn secondary small"
                                  onClick={() => openInvoice(x.id)}
                                >
                                  View
                                </button>
                                <button
                                  className="btn danger small"
                                  onClick={() => void removeInvoice(x)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="pagination-controls">
                    <span>
                      Showing {(currentPage - 1) * pageSize + 1}–
                      {Math.min(currentPage * pageSize, rows.length)} of {rows.length}
                    </span>
                    <label className="pagination-size">
                      Rows{' '}
                      <select
                        className="pagination_select"
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </label>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn secondary small"
                        disabled={currentPage === 1}
                        onClick={() => setPage(Math.max(1, currentPage - 1))}
                      >
                        Previous
                      </button>
                      <span className="pill">
                        Page {currentPage} of {pageCount}
                      </span>
                      <button
                        type="button"
                        className="btn secondary small"
                        disabled={currentPage === pageCount}
                        onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <Empty>No invoices match these filters.</Empty>
              )}
            </Card>
          )}
          {invoiceView === 'deleted' && (
            <Card className="billing-invoice-card">
              <div className="card-head">
                <div>
                  <h3>Deleted invoice history</h3>
                  <p className="sub">
                    Deleted invoices are retained for audit and cannot affect active billing totals.
                  </p>
                </div>
                <span className="pill">{deletedInvoices.length}</span>
              </div>
              {deletedInvoices.length ? (
                <div className="dashboard-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice no</th>
                        <th>Issued</th>
                        <th>Patient / party</th>
                        <th>Provider</th>
                        <th>Amount</th>
                        <th>Previous status</th>
                        <th>Deleted</th>
                        <th>Deleted by</th>
                        <th>Reason</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deletedInvoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>{invoice.invoice_number}</td>
                          <td>{invoice.issue_date}</td>
                          <td>
                            {invoice.company_name || invoice.patient_name}
                            {invoice.company_name && (
                              <div className="sub">Patient: {invoice.patient_name}</div>
                            )}
                          </td>
                          <td>{invoice.provider_name || '—'}</td>
                          <td>{money(invoice.total_amount)}</td>
                          <td>
                            <StatusPill status={invoice.status_before_delete || 'Void'} />
                          </td>
                          <td>{new Date(invoice.deleted_at).toLocaleString('en-ZA')}</td>
                          <td>{invoice.deleted_by_name || 'Administrator'}</td>
                          <td>{invoice.deletion_reason}</td>
                          <td>
                            <button
                              className="btn secondary small"
                              onClick={() => openInvoice(invoice.id)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No invoices have been deleted.</Empty>
              )}
            </Card>
          )}
          {invoiceView === 'active' && (
            <div className="billing-panel-grid">
              <Card>
                <div className="card-head">
                  <h3>Overdue invoices</h3>
                  {overview && overview.overdue.length > 5 && (
                    <button className="link-button" onClick={() => setOpenPanel('overdue')}>
                      View all
                    </button>
                  )}
                </div>
                {overview?.overdue.length ? (
                  <div className="dashboard-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Patient</th>
                          <th>Appointment</th>
                          <th>Balance</th>
                          <th>Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.overdue.slice(0, 5).map((x) => (
                          <tr key={x.id}>
                            <td>
                              <button className="link-button" onClick={() => openInvoice(x.id)}>
                                {x.invoice_number}
                              </button>
                            </td>
                            <td>{x.patient_name}</td>
                            <td>{x.appointment_date || '—'}</td>
                            <td>{money(x.outstanding_balance)}</td>
                            <td>{x.days_overdue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>No overdue invoices.</Empty>
                )}
              </Card>
              <Card>
                <div className="card-head">
                  <h3>Upcoming appointments - no invoice</h3>
                  {overview && overview.upcoming.length > 5 && (
                    <button className="link-button" onClick={() => setOpenPanel('upcoming')}>
                      View all
                    </button>
                  )}
                </div>
                {overview?.upcoming.length ? (
                  <div className="dashboard-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date / time</th>
                          <th>Patient</th>
                          <th>Provider</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.upcoming.slice(0, 5).map((x) => (
                          <tr key={x.appointment_id}>
                            <td>
                              {x.appointment_date}
                              <div className="sub">{x.appointment_time.slice(0, 5)}</div>
                            </td>
                            <td>{x.patient_name}</td>
                            <td>{x.provider_name}</td>
                            <td>—</td>
                            <td>
                              <StatusPill status={x.payment_status || 'Unpaid'} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>No upcoming appointments without an invoice.</Empty>
                )}
              </Card>
              <Card>
                <div className="card-head">
                  <h3>Recent credit notes</h3>
                  {overview && overview.credits.length > 5 && (
                    <button className="link-button" onClick={() => setOpenPanel('credits')}>
                      View all
                    </button>
                  )}
                </div>
                {overview?.credits.length ? (
                  <div className="dashboard-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Credit note</th>
                          <th>Invoice</th>
                          <th>Patient</th>
                          <th>Amount</th>
                          <th>Reason</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.credits.slice(0, 5).map((x) => (
                          <tr key={x.id}>
                            <td>{x.credit_note_number}</td>
                            <td>
                              <button
                                className="link-button"
                                onClick={() => openInvoice(x.invoice_id)}
                              >
                                {x.invoice_number}
                              </button>
                            </td>
                            <td>{x.patient_name}</td>
                            <td>{money(x.amount)}</td>
                            <td>{x.reason}</td>
                            <td>{x.credit_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>No credit notes.</Empty>
                )}
              </Card>
            </div>
          )}
        </>
      )}
      {creating && !error && (
        <InvoiceEditor
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
      {openPanel && overview && (
        <OverviewModal panel={openPanel} overview={overview} onClose={() => setOpenPanel(null)} />
      )}
    </section>
  );
}
