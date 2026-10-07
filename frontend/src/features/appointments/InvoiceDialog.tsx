import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Field } from '../../components/ui';
import Modal from '../../components/Modal';
import type { Appointment } from '../../types';

export default function InvoiceDialog({
  appointment,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const { notify } = useApp();
  const [amount, setAmount] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const raw = amount.trim(),
      value = Number(raw);
    if (!raw || !Number.isFinite(value) || value <= 0) {
      notify('Enter a valid invoice amount greater than 0');
      return;
    }
    const normalized = (Math.round(value * 100) / 100).toFixed(2);
    window.open(
      `/invoice.html?appointmentId=${encodeURIComponent(appointment.id)}&amount=${encodeURIComponent(normalized)}`,
      '_blank',
    );
    onClose();
  }

  return (
    <Modal title="Generate invoice" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Invoice Amount">
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="modal-actions">
          <button className="btn" type="submit">
            Generate Invoice
          </button>
          <button className="btn secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
