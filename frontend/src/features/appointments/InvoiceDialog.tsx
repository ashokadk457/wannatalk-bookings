import { useMemo, useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import Modal from '../../components/Modal';
import { formatDate } from '../../lib/dates';
import { mutate } from '../../services/api';
import type { Appointment } from '../../types';

export default function InvoiceDialog({
  appointment,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const { data, notify } = useApp();
  const appointments = useMemo(() => data.appointments
    .filter((item) => item.patient_id === appointment.patient_id && !['Cancelled', 'No-show'].includes(item.status))
    .sort((a, b) => `${a.appointment_date}${a.appointment_time}`.localeCompare(`${b.appointment_date}${b.appointment_time}`)), [appointment.patient_id, data.appointments]);
  const [selected, setSelected] = useState<string[]>([appointment.id]);
  const [amounts, setAmounts] = useState<Record<string, string>>({ [appointment.id]: '' });
  const [busy, setBusy] = useState(false);
  const total = selected.reduce((sum, id) => sum + (Number(amounts[id]) || 0), 0);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => checked ? [...current, id] : current.filter((value) => value !== id));
    if (checked) setAmounts((current) => ({ ...current, [id]: current[id] ?? '' }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected.length) return notify('Select at least one appointment');
    if (selected.some((id) => !amounts[id]?.trim() || !Number.isFinite(Number(amounts[id])) || Number(amounts[id]) <= 0)) {
      return notify('Enter a valid amount greater than 0 for every selected appointment');
    }
    const preview = window.open('', '_blank');
    if (preview) preview.document.write('<p style="font-family:Arial;padding:30px">Preparing invoice…</p>');
    setBusy(true);
    try {
      const result = await mutate<{ invoice: { id: string; invoice_number: string } }>('/invoices', 'POST', {
        items: selected.map((appointmentId) => ({ appointmentId, amount: Number(amounts[appointmentId]) })),
      });
      if (preview) preview.location.href = `/invoice.html?invoiceId=${encodeURIComponent(result.invoice.id)}`;
      else notify(`Invoice ${result.invoice.invoice_number} saved. Allow pop-ups to open the invoice.`);
      notify(`Invoice ${result.invoice.invoice_number} saved`);
      onClose();
    } catch (error) {
      preview?.close();
      notify(error instanceof Error ? error.message : 'Unable to create invoice');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Generate invoice" onClose={onClose}>
      <form className="invoice-form" onSubmit={submit} noValidate>
        <div className="invoice-patient"><span>Bill to</span><strong>{appointment.patient_name}</strong><small>{appointment.patient_email}</small></div>
        <p className="sub">Select one or more appointments for this patient and enter the amount for each line.</p>
        <div className="invoice-item-list">
          {appointments.map((item) => {
            const checked = selected.includes(item.id);
            return <label className={`invoice-item${checked ? ' selected' : ''}`} key={item.id}>
              <input className="compact-check" type="checkbox" checked={checked} onChange={(event) => toggle(item.id, event.target.checked)} />
              <span className="invoice-item-copy"><strong>{formatDate(item.appointment_date)} at {item.appointment_time}</strong><small>{item.appointment_type} · {item.provider_name} · {item.mode}</small></span>
              <span className="invoice-amount"><b>R</b><input aria-label={`Amount for ${item.appointment_date}`} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" disabled={!checked} required={checked} value={amounts[item.id] ?? ''} onChange={(event) => setAmounts((current) => ({ ...current, [item.id]: event.target.value }))} /></span>
            </label>;
          })}
        </div>
        <div className="invoice-form-total"><span>Total</span><strong>R {total.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
        <div className="modal-actions">
          <button className="btn" type="submit" disabled={busy || !selected.length}>
            {busy ? 'Creating invoice…' : 'Create Invoice'}
          </button>
          <button className="btn secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
