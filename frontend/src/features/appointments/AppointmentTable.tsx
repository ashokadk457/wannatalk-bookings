import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { MeetingLink } from '../../components/MeetingLink';
import { Empty, StatusPill } from '../../components/ui';
import { formatDate, joinAllowed } from '../../lib/dates';
import { AppointmentActions, useAppointments } from './AppointmentContext';
import { InvoiceEditor } from '../billing/InvoiceEditor';
import InvoiceDialog from './InvoiceDialog';
import { PaymentEditor, type Invoice as BillingInvoice } from '../billing/PaymentsPage';
import Modal from '../../components/Modal';
import { api } from '../../services/api';
import { statuses, type Appointment, type Status } from '../../types';
interface InvoicePaymentDetail {
  id: string;
  payment_date: string;
  allocated_amount: number;
  payment_amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  status: string;
  reversal_reason: string | null;
}

function ActionIcon({
  type,
  done = false,
}: {
  type: 'message' | 'invoice' | 'payment' | 'money' | 'followup';
  done?: boolean;
}) {
  const tone = done ? '#079b4b' : '#c52227';
  if (type === 'money') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill={tone} />
        <path
          d="M15.4 8.6c-.6-.7-1.7-1.1-3-1.1-1.6 0-2.7.8-2.7 2s1.1 1.8 2.7 2.2 2.7 1 2.7 2.2-1.1 2.2-2.8 2.2c-1.2 0-2.4-.5-3.1-1.2M12.3 5.8v12.4"
          fill="none"
          stroke="white"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (type === 'message') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill={tone} />
        <path d="M6 7.5h12v8H11l-3.5 2v-2H6z" fill="white" />
        <circle cx="9" cy="11.5" r=".8" fill={tone} />
        <circle cx="12" cy="11.5" r=".8" fill={tone} />
        <circle cx="15" cy="11.5" r=".8" fill={tone} />
      </svg>
    );
  }
  if (type === 'invoice') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill={tone} />
        <path
          d="M7 4.5h7l3 3V19H7z"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M14 4.8v3h3M9.5 10h4M9.5 12h4"
          fill="none"
          stroke="white"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M12.2 13.4v4m1.2-3.3c-.3-.4-.7-.5-1.2-.5-.7 0-1.1.3-1.1.8s.4.7 1.1.9 1.1.4 1.1.9-.4.8-1.1.8c-.5 0-1-.2-1.3-.5"
          fill="none"
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (type === 'payment')
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill={tone} />
        <rect
          x="4.5"
          y="6"
          width="14"
          height="10"
          rx="1.7"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
        />
        <path
          d="M5 9h13M7 13h3"
          fill="none"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="16.5" cy="16.5" r="4.5" fill="white" />
        <path
          d="m14.7 16.5 1.2 1.2 2.4-2.5"
          fill="none"
          stroke={tone}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill={tone} />
      <path
        d="M7 5.5h8l3 3V19H7z"
        fill="none"
        stroke="white"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10 11h5M10 14h5M10 17h3"
        fill="none"
        stroke="white"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {done && (
        <path
          d="m14.5 17 1.3 1.3 2.5-2.8"
          fill="none"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export default function AppointmentTable({
  appointments,
  editable = false,
  bulkMessaging = false,
  fullInvoiceEditor = false,
}: {
  appointments: Appointment[];
  editable?: boolean;
  bulkMessaging?: boolean;
  fullInvoiceEditor?: boolean;
}) {
  const { user, refresh } = useApp(),
    actions = useAppointments(),
    navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]),
    [invoiceAppointment, setInvoiceAppointment] = useState<Appointment | null>(null),
    [paymentAppointment, setPaymentAppointment] = useState<Appointment | null>(null),
    [paymentDetailsAppointment, setPaymentDetailsAppointment] = useState<Appointment | null>(null),
    [paymentDetails, setPaymentDetails] = useState<InvoicePaymentDetail[]>([]),
    [paymentDetailsLoading, setPaymentDetailsLoading] = useState(false),
    [paymentDetailsError, setPaymentDetailsError] = useState('');
  const patientIds = [...new Set(appointments.map((a) => a.patient_id))];
  const selectedPatients = selected.filter((id) => patientIds.includes(id));
  const selectAll = () =>
    setSelected(selectedPatients.length === patientIds.length ? [] : patientIds);
  async function showPaymentDetails(appointment: Appointment) {
    if (!appointment.invoice_id) return;
    setPaymentDetailsAppointment(appointment);
    setPaymentDetails([]);
    setPaymentDetailsError('');
    setPaymentDetailsLoading(true);
    try {
      const result = await api<{ payments: InvoicePaymentDetail[] }>(
        `/billing/invoices/${encodeURIComponent(appointment.invoice_id)}/payments`,
      );
      setPaymentDetails(result.payments);
    } catch (error) {
      setPaymentDetailsError(
        error instanceof Error ? error.message : 'Unable to load payment details',
      );
    } finally {
      setPaymentDetailsLoading(false);
    }
  }
  if (!appointments.length) return <Empty>No appointments match this view.</Empty>;
  return (
    <div className="dashboard-table">
      <table>
        <thead>
          <tr>
            {bulkMessaging && user?.role !== 'patient' && (
              <th>
                <input
                  className="compact-check"
                  type="checkbox"
                  aria-label="Select all patients"
                  checked={patientIds.length > 0 && selectedPatients.length === patientIds.length}
                  onChange={selectAll}
                />
              </th>
            )}
            <th>Date</th>
            <th>Time</th>
            {user?.role !== 'patient' && <th>Patient</th>}
            {user?.role !== 'provider' && <th>Provider</th>}
            <th>Type / location</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id} onDoubleClick={() => actions.open(a)}>
              {bulkMessaging && user?.role !== 'patient' && (
                <td>
                  <input
                    className="compact-check"
                    type="checkbox"
                    aria-label={`Select ${a.patient_name}`}
                    checked={selected.includes(a.patient_id)}
                    onChange={(e) =>
                      setSelected((current) =>
                        e.target.checked
                          ? [...current, a.patient_id]
                          : current.filter((id) => id !== a.patient_id),
                      )
                    }
                  />
                </td>
              )}
              <td>{formatDate(a.appointment_date)}</td>
              <td>
                <strong>{a.appointment_time}</strong>
                <span
                  className={`duration-pill duration-${a.duration_minutes <= 45 ? 'short' : a.duration_minutes <= 60 ? 'standard' : a.duration_minutes <= 90 ? 'long' : 'extended'}`}
                >
                  {a.duration_minutes} min
                </span>
              </td>
              {user?.role !== 'patient' && (
                <td>
                  <span className="patient-name">{a.patient_name}</span>
                  <div className="sub">{a.patient_mobile || a.patient_email}</div>
                </td>
              )}
              {user?.role !== 'provider' && (
                <td>
                  <span className="patient-name">{a.provider_name}</span>
                  <div className="sub">{a.professional_title}</div>
                </td>
              )}
              <td>
                {a.appointment_type}
                <div className="sub">📍 {a.location_name || a.mode}</div>
                {a.intake_requested && <div className="intake-badge">Intake selected</div>}
              </td>
              <td>
                {editable && user?.role !== 'patient' ? (
                  <select
                    aria-label={`Status for ${a.patient_name} on ${a.appointment_date}`}
                    title="Change appointment status: Booked, Confirmed, Arrived, Completed, Cancelled or No-show"
                    disabled={actions.busy}
                    value={a.status}
                    onChange={(e) => void actions.status(a, e.target.value as Status)}
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <StatusPill status={a.status} />
                )}
                {user?.role !== 'patient' && a.invoice_id && (
                  <div
                    className="appointment-invoice-status"
                    aria-label={`Invoice ${a.invoice_number}`}
                  >
                    <span
                      className={`invoice-status-badge ${a.billing_review ? 'overdue' : a.invoice_status === 'Paid' ? 'paid' : a.invoice_status === 'Overdue' ? 'overdue' : 'due'}`}
                    >
                      {a.billing_review
                        ? 'Billing review'
                        : a.invoice_status === 'Part Paid'
                          ? 'Partially paid'
                          : a.invoice_status === 'Issued'
                            ? 'Due'
                            : a.invoice_status}
                    </span>
                    {a.appointment_passed_unpaid && (
                      <span className="invoice-status-badge overdue">
                        Appointment passed unpaid
                      </span>
                    )}
                    <div className="sub">
                      {a.invoice_number} · R {Number(a.outstanding_balance || 0).toFixed(2)} balance
                    </div>
                  </div>
                )}
                {user?.role !== 'patient' && !a.invoice_id && (
                  <div className="appointment-invoice-status">
                    <span className="invoice-status-badge">No invoice</span>
                  </div>
                )}
              </td>
              <td>
                <div className="actions">
                  {joinAllowed(a) && <MeetingLink url={a.meeting_url} />}
                  {user?.role !== 'patient' && (
                    <button
                      className="btn secondary small appointment-icon-action"
                      data-tooltip="Message patient"
                      aria-label="Message patient"
                      onClick={() => actions.contact(a)}
                    >
                      <ActionIcon type="message" done={Boolean(a.message_sent)} />
                    </button>
                  )}
                  {user?.role !== 'patient' && !a.invoice_id && (
                    <button
                      className="btn secondary small appointment-icon-action"
                      data-tooltip="Generate invoice"
                      aria-label="Generate invoice"
                      onClick={() => setInvoiceAppointment(a)}
                    >
                      <ActionIcon type="invoice" done={Boolean(a.invoice_id)} />
                    </button>
                  )}
                  {user?.role !== 'patient' && a.invoice_id && (
                    <>
                      <button
                        className="btn secondary small appointment-icon-action"
                        data-tooltip="View invoice"
                        aria-label="View invoice"
                        onClick={() =>
                          window.open(
                            `/invoice.html?invoiceId=${encodeURIComponent(a.invoice_id!)}`,
                            '_blank',
                          )
                        }
                      >
                        <ActionIcon type="invoice" done />
                      </button>
                      {user?.role === 'admin' && <button
                        className="btn secondary small appointment-icon-action"
                        data-tooltip="View payment details"
                        aria-label="View payment details"
                        onClick={() => void showPaymentDetails(a)}
                      >
                        <ActionIcon type="payment" done={Number(a.outstanding_balance || 0) <= 0} />
                      </button>}
                      {user?.role === 'admin' && Number(a.outstanding_balance || 0) > 0 && (
                        <button
                          className="btn secondary small appointment-icon-action"
                          data-tooltip="Record payment"
                          aria-label="Record payment"
                          onClick={() => setPaymentAppointment(a)}
                        >
                          <ActionIcon type="money" />
                        </button>
                      )}
                    </>
                  )}
                  {user?.role !== 'patient' && (
                    <button
                      className="btn secondary small appointment-icon-action"
                      data-tooltip={
                        a.follow_up_attempted ? 'Follow-up send attempted' : 'Send follow-up'
                      }
                      aria-label={
                        a.follow_up_attempted ? 'Follow-up send attempted' : 'Send follow-up'
                      }
                      onClick={() =>
                        navigate(
                          `/${user?.role}/followups?appointmentId=${encodeURIComponent(a.id)}`,
                          {
                            state: {
                              patientId: a.patient_id,
                              providerId: a.provider_id,
                              appointmentId: a.id,
                            },
                          },
                        )
                      }
                    >
                      <ActionIcon type="followup" done={Boolean(a.follow_up_attempted)} />
                    </button>
                  )}
                  <AppointmentActions appointment={a} view includeDestructive={false} />
                  <AppointmentActions appointment={a} destructiveOnly />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {bulkMessaging && user?.role !== 'patient' && selectedPatients.length > 0 && (
        <div className="modal-actions space-top">
          <span>{selectedPatients.length} patient(s) selected</span>
          <button
            className="btn"
            onClick={() =>
              navigate(`/${user?.role}/appointment-messages`, {
                state: { patientIds: selectedPatients },
              })
            }
          >
            Message selected patients
          </button>
        </div>
      )}
      {invoiceAppointment &&
        (fullInvoiceEditor ? (
          <InvoiceEditor
            initialAppointment={invoiceAppointment}
            onClose={() => setInvoiceAppointment(null)}
            onSaved={() => void refresh()}
          />
        ) : (
          <InvoiceDialog
            appointment={invoiceAppointment}
            onClose={() => setInvoiceAppointment(null)}
          />
        ))}
      {paymentAppointment?.invoice_id && (
        <PaymentEditor
          invoices={[
            {
              id: paymentAppointment.invoice_id,
              invoice_number: paymentAppointment.invoice_number || '',
              provider_id: paymentAppointment.invoice_provider_id || paymentAppointment.provider_id,
              patient_id: paymentAppointment.invoice_patient_id || paymentAppointment.patient_id,
              company_id: paymentAppointment.invoice_company_id || null,
              billing_customer_type: paymentAppointment.invoice_billing_customer_type || 'patient',
              patient_name: paymentAppointment.patient_name,
              provider_name: paymentAppointment.provider_name,
              company_name: null,
              outstanding_balance: Number(paymentAppointment.outstanding_balance || 0),
              status: paymentAppointment.invoice_status || 'Issued',
            } as BillingInvoice,
          ]}
          initialInvoice={{
            id: paymentAppointment.invoice_id,
            invoice_number: paymentAppointment.invoice_number || '',
            provider_id: paymentAppointment.invoice_provider_id || paymentAppointment.provider_id,
            patient_id: paymentAppointment.invoice_patient_id || paymentAppointment.patient_id,
            company_id: paymentAppointment.invoice_company_id || null,
            billing_customer_type: paymentAppointment.invoice_billing_customer_type || 'patient',
            patient_name: paymentAppointment.patient_name,
            provider_name: paymentAppointment.provider_name,
            company_name: null,
            outstanding_balance: Number(paymentAppointment.outstanding_balance || 0),
            status: paymentAppointment.invoice_status || 'Issued',
          }}
          onClose={() => setPaymentAppointment(null)}
          onSaved={() => {
            setPaymentAppointment(null);
            void refresh();
          }}
        />
      )}
      {paymentDetailsAppointment?.invoice_id && (
        <Modal
          title={`Payment details · ${paymentDetailsAppointment.invoice_number || 'Invoice'}`}
          className="payment-details-dialog"
          onClose={() => setPaymentDetailsAppointment(null)}
        >
          {paymentDetailsLoading ? (
            <p className="payment-details-message">Loading payment details…</p>
          ) : paymentDetailsError ? (
            <p className="payment-editor-error" role="alert">
              {paymentDetailsError}
            </p>
          ) : paymentDetails.length ? (
            <div className="dashboard-table payment-details-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Applied</th>
                    <th>Payment amount</th>
                    <th>Method / reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentDetails.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.payment_date}</td>
                      <td>R {payment.allocated_amount.toFixed(2)}</td>
                      <td>R {payment.payment_amount.toFixed(2)}</td>
                      <td>
                        {payment.method}
                        <div className="sub">{payment.reference || 'No reference'}</div>
                        {payment.notes && <div className="sub">{payment.notes}</div>}
                      </td>
                      <td>
                        <StatusPill status={payment.status} />
                        {payment.reversal_reason && (
                          <div className="sub">{payment.reversal_reason}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="payment-details-message">
              No payments have been recorded for this invoice yet.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
