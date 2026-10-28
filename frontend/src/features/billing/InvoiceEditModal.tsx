import { useEffect, useState, type FormEvent } from 'react';
import Modal from '../../components/Modal';
import { Field } from '../../components/ui';
import { api, mutate } from '../../services/api';

interface StoredItem {
  id: string;
  appointment_id: string | null;
  service_date: string;
  description: string;
  tariff_code: string | null;
  icd10_code: string | null;
  document_number: string | null;
  quantity: number;
  rate: number;
  discount_amount: number;
  tax_amount: number;
}
interface StoredInvoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  notes: string | null;
  patient_name: string;
  provider_name: string;
  items: StoredItem[];
}
interface EditLine {
  key: string;
  appointmentId: string | null;
  serviceDate: string;
  description: string;
  tariffCode: string;
  icd10Code: string;
  documentNumber: string;
  quantity: string;
  rate: string;
  discountAmount: string;
  taxAmount: string;
}
const blankLine = (): EditLine => ({
  key: crypto.randomUUID(),
  appointmentId: null,
  serviceDate: new Date().toISOString().slice(0, 10),
  description: 'Professional consultation',
  tariffCode: '',
  icd10Code: '',
  documentNumber: '',
  quantity: '1',
  rate: '',
  discountAmount: '0',
  taxAmount: '0',
});

export default function InvoiceEditModal({
  invoiceId,
  onClose,
  onSaved,
}: {
  invoiceId: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [invoice, setInvoice] = useState<StoredInvoice | null>(null);
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<EditLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ invoice: StoredInvoice }>(`/invoices/${invoiceId}`)
      .then(({ invoice: value }) => {
        setInvoice(value);
        setIssueDate(value.issue_date.slice(0, 10));
        setDueDate(value.due_date?.slice(0, 10) || '');
        setNotes(value.notes || '');
        setLines(
          value.items.map((item) => ({
            key: item.id,
            appointmentId: item.appointment_id,
            serviceDate: item.service_date?.slice(0, 10) || '',
            description: item.description,
            tariffCode: item.tariff_code || '',
            icd10Code: item.icd10_code || '',
            documentNumber: item.document_number || '',
            quantity: String(item.quantity),
            rate: String(item.rate),
            discountAmount: String(item.discount_amount),
            taxAmount: String(item.tax_amount),
          })),
        );
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'Unable to load invoice'),
      );
  }, [invoiceId]);

  const update = (key: string, field: keyof EditLine, value: string) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, [field]: value } : line)),
    );
  const total = lines.reduce(
    (sum, line) =>
      sum +
      (Number(line.rate) || 0) * (Number(line.quantity) || 0) -
      (Number(line.discountAmount) || 0) +
      (Number(line.taxAmount) || 0),
    0,
  );

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return setError('Enter a reason for this edit');
    setBusy(true);
    setError('');
    try {
      await mutate(`/invoices/${invoiceId}`, 'PATCH', {
        issueDate,
        dueDate,
        notes,
        reason,
        items: lines.map(({ key: _key, ...line }) => ({
          ...line,
          quantity: Number(line.quantity),
          rate: Number(line.rate),
          discountAmount: Number(line.discountAmount),
          taxAmount: Number(line.taxAmount),
        })),
      });
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to edit invoice');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Edit invoice ${invoice?.invoice_number || ''}`}
      className="invoice-workspace"
      onClose={onClose}
    >
      {!invoice ? (
        <p>{error || 'Loading invoice…'}</p>
      ) : (
        <form className="billing-invoice-editor" onSubmit={save}>
          <div className="invoice-workspace-body">
            <section className="invoice-setup-panel">
              <h4>Invoice details</h4>
              <p className="sub">
                {invoice.patient_name} · {invoice.provider_name}
              </p>
              <div className="form-grid invoice-header-grid">
                <Field label="Issue date">
                  <input
                    required
                    type="date"
                    value={issueDate}
                    onChange={(event) => setIssueDate(event.target.value)}
                  />
                </Field>
                <Field label="Due date">
                  <input
                    required
                    type="date"
                    min={issueDate}
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </Field>
                <Field label="Reason for edit" full>
                  <textarea
                    required
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain why this invoice is being changed"
                  />
                </Field>
                <Field label="Invoice notes" full>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </Field>
              </div>
              <div className="notice">
                The complete current invoice will be copied to edit history before these changes are
                saved.
              </div>
            </section>
            <section className="billing-lines">
              <div className="card-head">
                <div>
                  <h4>Invoice lines</h4>
                  <p className="sub">Edit services, codes, quantities and amounts.</p>
                </div>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setLines((current) => [...current, blankLine()])}
                >
                  + Add line
                </button>
              </div>
              <div className="billing-line billing-line-labels">
                <span>Line</span>
                <span>Service date</span>
                <span>Description</span>
                <span>Tariff</span>
                <span>ICD-10</span>
                <span>Qty</span>
                <span>Rate</span>
                <span>Discount</span>
                <span>Tax</span>
                <span></span>
              </div>
              <div className="billing-line-scroll">
                {lines.map((line, index) => (
                  <div className="billing-line" key={line.key}>
                    <strong>{index + 1}</strong>
                    <input
                      aria-label="Service date"
                      required
                      type="date"
                      value={line.serviceDate}
                      onChange={(event) => update(line.key, 'serviceDate', event.target.value)}
                    />
                    <input
                      aria-label="Description"
                      required
                      value={line.description}
                      onChange={(event) => update(line.key, 'description', event.target.value)}
                    />
                    <input
                      aria-label="Tariff code"
                      value={line.tariffCode}
                      onChange={(event) => update(line.key, 'tariffCode', event.target.value)}
                    />
                    <input
                      aria-label="ICD-10"
                      value={line.icd10Code}
                      onChange={(event) => update(line.key, 'icd10Code', event.target.value)}
                    />
                    <input
                      aria-label="Quantity"
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.quantity}
                      onChange={(event) => update(line.key, 'quantity', event.target.value)}
                    />
                    <input
                      aria-label="Rate"
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.rate}
                      onChange={(event) => update(line.key, 'rate', event.target.value)}
                    />
                    <input
                      aria-label="Discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.discountAmount}
                      onChange={(event) => update(line.key, 'discountAmount', event.target.value)}
                    />
                    <input
                      aria-label="Tax"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.taxAmount}
                      onChange={(event) => update(line.key, 'taxAmount', event.target.value)}
                    />
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label="Remove line"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) => current.filter((item) => item.key !== line.key))
                      }
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <footer className="invoice-workspace-footer">
            <div className="invoice-save-feedback">{error && <p role="alert">{error}</p>}</div>
            <div className="invoice-form-total">
              <span>{total === 0 ? 'Invoice will be voided' : 'Revised total'}</span>
              <strong>
                R{' '}
                {total.toLocaleString('en-ZA', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
            <div className="modal-actions">
              <button className="btn" disabled={busy}>
                {busy ? 'Saving revision…' : total === 0 ? 'Void invoice' : 'Save invoice revision'}
              </button>
              <button type="button" className="btn secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </footer>
        </form>
      )}
    </Modal>
  );
}
