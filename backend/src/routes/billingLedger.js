import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { authRequired } from "../middleware/authRequired.js";
import { generateHtmlPdf, passwordProtectPdf } from "../invoice.js";
import { sendInvoiceEmail } from "../mail.js";
import { sendWhatsAppMsg } from "../whatsapp.js";

export const billingLedgerRouter = Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const fail = (message) =>
  Object.assign(new Error(message), { statusCode: 400 });
const cash = (value) => Math.round(Number(value) * 100) / 100;
const date = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null;
const actor = (user) => user.name || user.email || "Administrator";
const html = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const formatMoney = (value) =>
  `R ${Number(value || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
async function audit(client, user, action, details) {
  await client.query(
    `INSERT INTO audit_logs(user_id,user_name,user_role,action,details) VALUES($1,$2,$3,$4,$5::jsonb)`,
    [user.id, actor(user), user.role, action, JSON.stringify(details)],
  );
}
async function refreshInvoice(client, id) {
  const result = await client.query(
    `SELECT i.total_amount,COALESCE((SELECT SUM(pa.amount) FROM billing_payment_allocations pa JOIN billing_payments p ON p.id=pa.payment_id WHERE pa.invoice_id=i.id AND p.status='Active'),0) paid,COALESCE((SELECT SUM(c.amount) FROM billing_credit_notes c WHERE c.invoice_id=i.id AND c.status='Issued'),0) credited,i.due_at,i.due_date FROM invoices i WHERE i.id=$1 FOR UPDATE`,
    [id],
  );
  if (!result.rows[0]) throw fail("Invoice not found");
  const row = result.rows[0],
    outstanding = Math.max(
      0,
      cash(Number(row.total_amount) - Number(row.paid) - Number(row.credited)),
    );
  const status =
    Number(row.credited) >= Number(row.total_amount)
      ? "Credited"
      : outstanding === 0
        ? "Paid"
        : Number(row.paid) > 0 || Number(row.credited) > 0
          ? "Part Paid"
          : new Date(row.due_at || `${row.due_date}T23:59:59+02:00`) <
              new Date()
            ? "Overdue"
            : "Issued";
  await client.query(
    `UPDATE invoices SET payments_received=$1,outstanding_balance=$2,status=$3,updated_at=now() WHERE id=$4`,
    [row.paid, outstanding, status, id],
  );
  return outstanding;
}
function accountWhere(providerId, type, customerId, startIndex = 1) {
  return type === "company"
    ? {
        sql: `provider_id=$${startIndex} AND company_id=$${startIndex + 1}`,
        params: [providerId, customerId],
      }
    : {
        sql: `provider_id=$${startIndex} AND customer_type='patient' AND patient_id=$${startIndex + 1}`,
        params: [providerId, customerId],
      };
}

billingLedgerRouter.get(
  "/overview",
  authRequired(["admin", "provider"]),
  asyncHandler(async (req, res) => {
    const providerUserId = req.user.role === "provider" ? req.user.id : null;
    await query(
      `UPDATE invoices SET status='Overdue',updated_at=now() WHERE status='Issued' AND outstanding_balance>0 AND due_at<now()`,
    );
    const result = await query(
      `SELECT COALESCE(SUM(total_amount),0) invoiced,COALESCE(SUM(payments_received),0) paid,COALESCE(SUM(outstanding_balance),0) outstanding,COUNT(*)::int invoice_count,COUNT(*) FILTER(WHERE status='Paid')::int paid_count,COUNT(*) FILTER(WHERE status='Issued')::int due_count,COALESCE(SUM(outstanding_balance) FILTER(WHERE status='Issued'),0) due_amount,COUNT(*) FILTER(WHERE status='Overdue')::int overdue_count,COALESCE(SUM(outstanding_balance) FILTER(WHERE status='Overdue'),0) overdue_amount,COUNT(*) FILTER(WHERE status='Part Paid')::int partially_paid_count,COALESCE(SUM(outstanding_balance) FILTER(WHERE status='Part Paid'),0) partially_paid_amount,COUNT(*) FILTER(WHERE status='Credited')::int credited_count,COALESCE(SUM(total_amount) FILTER(WHERE status='Credited'),0) credited_amount,COUNT(*) FILTER(WHERE billing_review)::int billing_review_count,COALESCE(SUM(outstanding_balance) FILTER(WHERE billing_review),0) billing_review_amount FROM invoices i WHERE status NOT IN('Void') AND ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM providers owned WHERE owned.id=i.provider_id AND owned.user_id=$1))`,
      [providerUserId],
    );
    const payments = await query(
      `SELECT COALESCE(SUM(amount),0) received,COALESCE(SUM(unallocated_amount),0) unallocated FROM billing_payments payment WHERE status='Active' AND ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM providers owned WHERE owned.id=payment.provider_id AND owned.user_id=$1))`,
      [providerUserId],
    );
    const creditTotals = await query(
      `SELECT COUNT(*)::int credited_count,COALESCE(SUM(amount),0) credited_amount FROM billing_credit_notes credit WHERE status='Issued' AND ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM providers owned WHERE owned.id=credit.provider_id AND owned.user_id=$1))`,
      [providerUserId],
    );
    const overdue = await query(
      `SELECT i.id,i.invoice_number,u.full_name patient_name,a.appointment_date::text,i.outstanding_balance,GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (now()-i.due_at))/86400))::int days_overdue FROM invoices i JOIN patients p ON p.id=i.patient_id JOIN app_users u ON u.id=p.user_id LEFT JOIN LATERAL(SELECT COALESCE(ap.appointment_date,ii.service_date) appointment_date FROM invoice_items ii LEFT JOIN appointments ap ON ap.id=ii.appointment_id WHERE ii.invoice_id=i.id ORDER BY ii.created_at LIMIT 1)a ON true WHERE i.status='Overdue' AND ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM providers owned WHERE owned.id=i.provider_id AND owned.user_id=$1)) ORDER BY i.due_at`,
      [providerUserId],
    );
    const upcoming = await query(
      `SELECT a.id appointment_id,a.appointment_date::text,a.appointment_time::time::text appointment_time,a.payment_status,u.full_name patient_name,pu.full_name provider_name,i.id invoice_id,i.invoice_number,i.total_amount,i.outstanding_balance,i.status,i.billing_review FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN app_users u ON u.id=p.user_id JOIN providers pr ON pr.id=a.provider_id JOIN app_users pu ON pu.id=pr.user_id LEFT JOIN LATERAL(SELECT iv.* FROM invoice_items ii JOIN invoices iv ON iv.id=ii.invoice_id WHERE ii.appointment_id=a.id AND iv.status NOT IN('Void','Credited') ORDER BY iv.created_at DESC LIMIT 1)i ON true WHERE (a.appointment_date+a.appointment_time)>=now() AND a.status NOT IN('Cancelled','No-show') AND i.id IS NULL AND ($1::uuid IS NULL OR pr.user_id=$1) ORDER BY a.appointment_date,a.appointment_time`,
      [providerUserId],
    );
    const credits = await query(
      `SELECT c.id,c.credit_note_number,i.id invoice_id,i.invoice_number,u.full_name patient_name,c.amount,c.reason,c.credit_date::text FROM billing_credit_notes c JOIN invoices i ON i.id=c.invoice_id JOIN patients p ON p.id=c.patient_id JOIN app_users u ON u.id=p.user_id WHERE c.status='Issued' AND ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM providers owned WHERE owned.id=c.provider_id AND owned.user_id=$1)) ORDER BY c.credit_date DESC,c.created_at DESC`,
      [providerUserId],
    );
    res.json({
      summary: {
        ...result.rows[0],
        ...payments.rows[0],
        ...creditTotals.rows[0],
      },
      overdue: overdue.rows.map((x) => ({
        ...x,
        outstanding_balance: Number(x.outstanding_balance),
      })),
      upcoming: upcoming.rows.map((x) => ({
        ...x,
        total_amount: Number(x.total_amount || 0),
        outstanding_balance: Number(x.outstanding_balance || 0),
      })),
      credits: credits.rows.map((x) => ({ ...x, amount: Number(x.amount) })),
    });
  }),
);

billingLedgerRouter.get(
  "/payments",
  authRequired(["admin"]),
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT p.*,u.full_name patient_name,c.registered_name company_name,pu.full_name provider_name,COALESCE(json_agg(json_build_object('invoiceId',i.id,'invoiceNumber',i.invoice_number,'amount',a.amount)) FILTER(WHERE a.id IS NOT NULL),'[]') allocations FROM billing_payments p JOIN providers pr ON pr.id=p.provider_id JOIN app_users pu ON pu.id=pr.user_id LEFT JOIN patients pt ON pt.id=p.patient_id LEFT JOIN app_users u ON u.id=pt.user_id LEFT JOIN billing_companies c ON c.id=p.company_id LEFT JOIN billing_payment_allocations a ON a.payment_id=p.id LEFT JOIN invoices i ON i.id=a.invoice_id GROUP BY p.id,u.full_name,c.registered_name,pu.full_name ORDER BY p.payment_date DESC,p.created_at DESC`,
    );
    res.json({
      payments: result.rows.map((x) => ({
        ...x,
        amount: Number(x.amount),
        unallocated_amount: Number(x.unallocated_amount),
      })),
    });
  }),
);

billingLedgerRouter.get(
  "/invoices/:invoiceId/payments",
  authRequired(["admin"]),
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT p.id,p.payment_date::date::text AS payment_date,a.amount AS allocated_amount,p.amount AS payment_amount,p.method,p.reference,p.notes,p.status,p.reversal_reason FROM billing_payment_allocations a JOIN billing_payments p ON p.id=a.payment_id WHERE a.invoice_id=$1 ORDER BY p.payment_date DESC,p.created_at DESC`,
      [req.params.invoiceId],
    );
    res.json({
      payments: result.rows.map((p) => ({
        ...p,
        allocated_amount: Number(p.allocated_amount),
        payment_amount: Number(p.payment_amount),
      })),
    });
  }),
);

billingLedgerRouter.post(
  "/payments",
  authRequired(["admin"]),
  asyncHandler(async (req, res) => {
    const amount = cash(req.body.amount),
      paymentDate = date(req.body.paymentDate),
      providerId = String(req.body.providerId || ""),
      type = req.body.customerType === "company" ? "company" : "patient",
      customerId = String(req.body.customerId || ""),
      allocations = Array.isArray(req.body.allocations)
        ? req.body.allocations
        : [];
    if (!amount || amount <= 0 || !paymentDate || !providerId || !customerId)
      throw fail(
        "Provider, customer, payment date and a valid amount are required",
      );
    const payment = await withTransaction(async (client) => {
      let allocated = 0,
        seen = new Set();
      for (const allocation of allocations) {
        const value = cash(allocation.amount);
        if (
          !allocation.invoiceId ||
          !value ||
          value <= 0 ||
          seen.has(allocation.invoiceId)
        )
          throw fail("Enter valid, unique invoice allocations");
        seen.add(allocation.invoiceId);
        allocated = cash(allocated + value);
      }
      if (allocated > amount)
        throw fail("Allocated amount cannot exceed the payment amount");
      const ids = [...seen];
      let invoices = [];
      if (ids.length) {
        const found = await client.query(
          `SELECT id,provider_id,patient_id,company_id,billing_customer_type,outstanding_balance,invoice_number FROM invoices WHERE id=ANY($1::uuid[]) FOR UPDATE`,
          [ids],
        );
        if (found.rows.length !== ids.length)
          throw fail("One or more invoices no longer exist");
        invoices = found.rows;
      }
      for (const allocation of allocations) {
        const invoice = invoices.find((x) => x.id === allocation.invoiceId),
          value = cash(allocation.amount);
        if (
          invoice.provider_id !== providerId ||
          invoice.billing_customer_type !== type ||
          (type === "company" ? invoice.company_id : invoice.patient_id) !==
            customerId
        )
          throw fail(
            `Invoice ${invoice.invoice_number} belongs to a different ledger`,
          );
        if (value > Number(invoice.outstanding_balance))
          throw fail(
            `Allocation exceeds the outstanding balance on ${invoice.invoice_number}`,
          );
      }
      const saved = await client.query(
        `INSERT INTO billing_payments(provider_id,patient_id,company_id,customer_type,payment_date,amount,unallocated_amount,method,reference,notes,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          providerId,
          type === "patient" ? customerId : null,
          type === "company" ? customerId : null,
          type,
          paymentDate,
          amount,
          cash(amount - allocated),
          String(req.body.method || "Bank transfer").slice(0, 80),
          String(req.body.reference || "")
            .trim()
            .slice(0, 150) || null,
          String(req.body.notes || "")
            .trim()
            .slice(0, 1000) || null,
          req.user.id,
        ],
      );
      for (const allocation of allocations) {
        await client.query(
          `INSERT INTO billing_payment_allocations(payment_id,invoice_id,amount) VALUES($1,$2,$3)`,
          [saved.rows[0].id, allocation.invoiceId, cash(allocation.amount)],
        );
        await refreshInvoice(client, allocation.invoiceId);
      }
      await audit(client, req.user, "Captured billing payment", {
        paymentId: saved.rows[0].id,
        amount,
        allocated,
        reference: saved.rows[0].reference,
      });
      return saved.rows[0];
    });
    res.status(201).json({ payment });
  }),
);

billingLedgerRouter.post(
  "/payments/:id/reverse",
  authRequired(["admin"]),
  asyncHandler(async (req, res) => {
    const reason = String(req.body.reason || "").trim();
    if (!reason) throw fail("A reversal reason is required");
    await withTransaction(async (client) => {
      const p = await client.query(
        `SELECT * FROM billing_payments WHERE id=$1 FOR UPDATE`,
        [req.params.id],
      );
      if (!p.rows[0]) throw fail("Payment not found");
      if (p.rows[0].status === "Reversed")
        throw fail("Payment has already been reversed");
      const allocations = await client.query(
        `SELECT invoice_id FROM billing_payment_allocations WHERE payment_id=$1`,
        [req.params.id],
      );
      await client.query(
        `UPDATE billing_payments SET status='Reversed',reversed_by_user_id=$1,reversed_at=now(),reversal_reason=$2 WHERE id=$3`,
        [req.user.id, reason, req.params.id],
      );
      for (const x of allocations.rows)
        await refreshInvoice(client, x.invoice_id);
      await audit(client, req.user, "Reversed billing payment", {
        paymentId: req.params.id,
        reason,
      });
    });
    res.json({ success: true });
  }),
);

billingLedgerRouter.post(
  "/credit-notes",
  authRequired(["admin"]),
  asyncHandler(async (req, res) => {
    const amount = cash(req.body.amount),
      creditDate = date(req.body.creditDate),
      reason = String(req.body.reason || "").trim();
    if (!amount || amount <= 0 || !creditDate || !reason)
      throw fail("Credit date, amount and reason are required");
    const credit = await withTransaction(async (client) => {
      const invoiceResult = await client.query(
        `SELECT * FROM invoices WHERE id=$1 FOR UPDATE`,
        [req.body.invoiceId],
      );
      const invoice = invoiceResult.rows[0];
      if (!invoice) throw fail("Invoice not found");
      if (["Void", "Credited"].includes(invoice.status))
        throw fail("This invoice cannot be credited");
      if (amount > Number(invoice.outstanding_balance))
        throw fail(
          "Credit amount cannot exceed the invoice outstanding balance",
        );
      const profile = await client.query(
        `SELECT * FROM provider_billing_profiles WHERE provider_id=$1 FOR UPDATE`,
        [invoice.provider_id],
      );
      const p = profile.rows[0];
      if (!p) throw fail("Provider billing profile not found");
      const number = `CN-${p.invoice_prefix}-${String(p.credit_note_next_number).padStart(p.invoice_number_padding, "0")}`;
      const saved = await client.query(
        `INSERT INTO billing_credit_notes(credit_note_number,provider_id,invoice_id,patient_id,company_id,credit_date,amount,reason,issuer_snapshot,customer_snapshot,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          number,
          invoice.provider_id,
          invoice.id,
          invoice.patient_id,
          invoice.company_id,
          creditDate,
          amount,
          reason,
          invoice.issuer_snapshot,
          invoice.customer_snapshot,
          req.user.id,
        ],
      );
      await client.query(
        `UPDATE provider_billing_profiles SET credit_note_next_number=credit_note_next_number+1 WHERE provider_id=$1`,
        [invoice.provider_id],
      );
      await refreshInvoice(client, invoice.id);
      await client.query(
        `UPDATE invoices SET billing_review=false,billing_review_reason=NULL WHERE id=$1`,
        [invoice.id],
      );
      await audit(client, req.user, "Issued credit note", {
        creditNoteId: saved.rows[0].id,
        creditNoteNumber: number,
        invoiceId: invoice.id,
        amount,
        reason,
      });
      return saved.rows[0];
    });
    res.status(201).json({ credit });
  }),
);

billingLedgerRouter.get(
  "/credit-notes",
  authRequired(["admin"]),
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT c.id,c.credit_note_number,c.credit_date::text,c.amount,c.reason,c.status,c.reversal_reason,i.invoice_number,u.full_name patient_name,bc.registered_name company_name,pu.full_name provider_name FROM billing_credit_notes c JOIN invoices i ON i.id=c.invoice_id JOIN patients p ON p.id=c.patient_id JOIN app_users u ON u.id=p.user_id JOIN providers pr ON pr.id=c.provider_id JOIN app_users pu ON pu.id=pr.user_id LEFT JOIN billing_companies bc ON bc.id=c.company_id ORDER BY c.credit_date DESC,c.created_at DESC`,
    );
    res.json({
      credits: result.rows.map((x) => ({ ...x, amount: Number(x.amount) })),
    });
  }),
);

billingLedgerRouter.post(
  "/credit-notes/:id/reverse",
  authRequired(["admin"]),
  asyncHandler(async (req, res) => {
    const reason = String(req.body.reason || "").trim();
    if (!reason) throw fail("A reversal reason is required");
    await withTransaction(async (client) => {
      const found = await client.query(
        `SELECT * FROM billing_credit_notes WHERE id=$1 FOR UPDATE`,
        [req.params.id],
      );
      const credit = found.rows[0];
      if (!credit) throw fail("Credit note not found");
      if (credit.status === "Reversed")
        throw fail("Credit note has already been reversed");
      await client.query(
        `UPDATE billing_credit_notes SET status='Reversed',reversed_by_user_id=$1,reversed_at=now(),reversal_reason=$2 WHERE id=$3`,
        [req.user.id, reason, req.params.id],
      );
      await refreshInvoice(client, credit.invoice_id);
      await audit(client, req.user, "Reversed credit note", {
        creditNoteId: credit.id,
        creditNoteNumber: credit.credit_note_number,
        reason,
      });
    });
    res.json({ success: true });
  }),
);

billingLedgerRouter.get(
  "/refunds",
  authRequired(["admin"]),
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT r.id,r.refund_date::text,r.amount,r.method,r.reference,r.reason,r.status,r.reversal_reason,i.invoice_number,u.full_name patient_name,pu.full_name provider_name FROM billing_refunds r JOIN invoices i ON i.id=r.invoice_id JOIN patients p ON p.id=r.patient_id JOIN app_users u ON u.id=p.user_id JOIN providers pr ON pr.id=r.provider_id JOIN app_users pu ON pu.id=pr.user_id ORDER BY r.refund_date DESC,r.created_at DESC`,
    );
    res.json({
      refunds: result.rows.map((x) => ({ ...x, amount: Number(x.amount) })),
    });
  }),
);

billingLedgerRouter.post(
  "/refunds",
  authRequired(["admin"]),
  asyncHandler(async (req, res) => {
    const amount = cash(req.body.amount),
      refundDate = date(req.body.refundDate),
      reason = String(req.body.reason || "").trim(),
      method = String(req.body.method || "").trim();
    if (!amount || amount <= 0 || !refundDate || !reason || !method)
      throw fail("Refund date, amount, method and reason are required");
    const refund = await withTransaction(async (client) => {
      const found = await client.query(
        `SELECT i.*,COALESCE((SELECT SUM(r.amount) FROM billing_refunds r WHERE r.invoice_id=i.id AND r.status='Paid'),0) refunded FROM invoices i WHERE i.id=$1 FOR UPDATE`,
        [req.body.invoiceId],
      );
      const invoice = found.rows[0];
      if (!invoice) throw fail("Invoice not found");
      if (amount > Number(invoice.payments_received) - Number(invoice.refunded))
        throw fail(
          "Refund amount cannot exceed payments received less earlier refunds",
        );
      const saved = await client.query(
        `INSERT INTO billing_refunds(provider_id,patient_id,company_id,invoice_id,payment_id,refund_date,amount,method,reference,reason,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          invoice.provider_id,
          invoice.patient_id,
          invoice.company_id,
          invoice.id,
          req.body.paymentId || null,
          refundDate,
          amount,
          method.slice(0, 80),
          String(req.body.reference || "")
            .trim()
            .slice(0, 150) || null,
          reason.slice(0, 1000),
          req.user.id,
        ],
      );
      await client.query(
        `UPDATE invoices SET billing_review=false,billing_review_reason=NULL,updated_at=now() WHERE id=$1`,
        [invoice.id],
      );
      await audit(client, req.user, "Recorded billing refund", {
        refundId: saved.rows[0].id,
        invoiceId: invoice.id,
        amount,
        reason,
        method,
      });
      return saved.rows[0];
    });
    res.status(201).json({ refund });
  }),
);

async function assertStatementAccess(user, providerId) {
  if (user.role === "admin") return;
  const owned = await query(
    `SELECT 1 FROM providers WHERE id=$1 AND user_id=$2`,
    [providerId, user.id],
  );
  if (!owned.rows[0]) {
    const error = new Error("Not allowed to access another provider's statement");
    error.statusCode = 403;
    throw error;
  }
}

async function buildStatement(input) {
  const providerId = String(input.providerId || ""),
    type = input.customerType === "company" ? "company" : "patient",
    customerId = String(input.customerId || ""),
    from = date(input.from),
    to = date(input.to);
  if (!providerId || !customerId || !from || !to)
    throw fail("Provider, account and statement period are required");
  if (from > to) throw fail("Statement start date cannot be after the end date");
  const invoiceAccount = type === "company"
    ? "provider_id=$1 AND billing_customer_type='company' AND company_id=$2"
    : "provider_id=$1 AND billing_customer_type='patient' AND patient_id=$2";
  const paymentAccount = type === "company"
    ? "p.provider_id=$1 AND p.customer_type='company' AND p.company_id=$2"
    : "p.provider_id=$1 AND p.customer_type='patient' AND p.patient_id=$2";
  const invoices = await query(
    `SELECT id,invoice_number,issue_date::text transaction_date,total_amount amount,outstanding_balance,status FROM invoices WHERE ${invoiceAccount} AND issue_date<=$3 AND status<>'Void' ORDER BY issue_date,invoice_number`,
    [providerId, customerId, to],
  );
  const payments = await query(
    `SELECT p.id,p.payment_date::text transaction_date,p.reference,p.amount,p.status FROM billing_payments p WHERE ${paymentAccount} AND p.payment_date<=$3 ORDER BY p.payment_date,p.created_at`,
    [providerId, customerId, to],
  );
  const credits = await query(
    `SELECT c.id,c.credit_note_number,c.credit_date::text transaction_date,c.amount,c.reason,c.status,i.invoice_number FROM billing_credit_notes c JOIN invoices i ON i.id=c.invoice_id WHERE c.provider_id=$1 AND ${type === "company" ? "c.company_id" : "c.patient_id"}=$2 AND c.credit_date<=$3 ORDER BY c.credit_date,c.created_at`,
    [providerId, customerId, to],
  );
  const priorInvoices = invoices.rows
      .filter((x) => x.transaction_date < from)
      .reduce((s, x) => s + Number(x.amount), 0),
    priorPayments = payments.rows
      .filter((x) => x.transaction_date < from && x.status === "Active")
      .reduce((s, x) => s + Number(x.amount), 0),
    priorCredits = credits.rows
      .filter((x) => x.transaction_date < from && x.status === "Issued")
      .reduce((s, x) => s + Number(x.amount), 0);
  let balance = cash(priorInvoices - priorPayments - priorCredits);
  const openingBalance = balance;
  const transactions = [
    ...invoices.rows
      .filter((x) => x.transaction_date >= from)
      .map((x) => ({
        date: x.transaction_date,
        type: "Invoice",
        reference: x.invoice_number,
        debit: Number(x.amount),
        credit: 0,
        status: x.status,
      })),
    ...payments.rows
      .filter((x) => x.transaction_date >= from && x.status === "Active")
      .map((x) => ({
        date: x.transaction_date,
        type: "Payment",
        reference: x.reference || "Payment",
        debit: 0,
        credit: Number(x.amount),
        status: x.status,
      })),
    ...credits.rows
      .filter((x) => x.transaction_date >= from && x.status === "Issued")
      .map((x) => ({
        date: x.transaction_date,
        type: "Credit note",
        reference: x.credit_note_number,
        debit: 0,
        credit: Number(x.amount),
        status: x.status,
      })),
  ]
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type),
    )
    .map((x) => {
      balance = cash(balance + x.debit - x.credit);
      return { ...x, balance };
    });
  const provider = await query(
    `SELECT u.full_name,bp.registered_business_name,bp.billing_email,bp.billing_phone,
            bp.billing_address,bp.logo_url,bp.brand_primary_color,p.practice_number,
            p.medical_registration_number,bp.bank_account_holder,bp.bank_name,
            bp.bank_account_number,bp.bank_account_type,bp.bank_branch_code,
            bp.remittance_instructions
       FROM providers p JOIN app_users u ON u.id=p.user_id
       LEFT JOIN provider_billing_profiles bp ON bp.provider_id=p.id WHERE p.id=$1`,
    [providerId],
  );
  const customer =
    type === "company"
      ? await query(
          `SELECT registered_name name,billing_email email,phone FROM billing_companies WHERE id=$1`,
          [customerId],
        )
      : await query(
          `SELECT u.full_name name,u.email,u.mobile phone FROM patients p JOIN app_users u ON u.id=p.user_id WHERE p.id=$1`,
          [customerId],
        );
  if (!provider.rows[0] || !customer.rows[0])
    throw fail("Provider or billing account not found");
  return {
    provider: provider.rows[0],
    customer: customer.rows[0],
    customerType: type,
    from,
    to,
    openingBalance,
    transactions,
    closingBalance: balance,
  };
}

async function statementPdfPassword(input) {
  const customerId = String(input.customerId || "");
  const customerType = input.customerType === "company" ? "company" : "patient";
  if (!customerId) throw fail("A billing account is required");
  let identityDocument = "";
  let phone = "";
  if (customerType === "patient") {
    const encryptionKey = process.env.PII_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!encryptionKey) {
      const error = new Error("PII encryption is not configured");
      error.statusCode = 500;
      throw error;
    }
    const result = await query(
      `SELECT CASE WHEN p.identity_document_encrypted IS NULL THEN NULL
                   ELSE pgp_sym_decrypt(p.identity_document_encrypted,$2) END identity_document,
              u.mobile phone
         FROM patients p JOIN app_users u ON u.id=p.user_id WHERE p.id=$1`,
      [customerId, encryptionKey],
    );
    if (!result.rows[0]) throw fail("Patient not found");
    identityDocument = String(result.rows[0].identity_document || "").trim();
    phone = String(result.rows[0].phone || "");
  } else {
    const result = await query(`SELECT phone FROM billing_companies WHERE id=$1`, [customerId]);
    if (!result.rows[0]) throw fail("Billing account not found");
    phone = String(result.rows[0].phone || "");
  }
  if (identityDocument) {
    return {
      password: identityDocument,
      method: "identity-document",
      guidance: "Use the patient's full ID or passport number to open the PDF.",
    };
  }
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length >= 6) {
    return {
      password: phoneDigits.slice(-6),
      method: "phone-last-6",
      guidance: "Use the last 6 digits of the billing account phone number to open the PDF.",
    };
  }
  throw fail("Add the patient's ID/passport number or a phone number with at least 6 digits before creating a protected statement PDF");
}

function statementHtml(s) {
  const rows = s.transactions
    .map(
      (x) =>
        `<tr><td>${html(x.date)}</td><td>${html(x.type)}</td><td>${html(x.reference)}</td><td>${x.debit ? html(formatMoney(x.debit)) : "—"}</td><td>${x.credit ? html(formatMoney(x.credit)) : "—"}</td><td><b>${html(formatMoney(x.balance))}</b></td></tr>`,
    )
    .join("");
  const providerName = s.provider.registered_business_name || s.provider.full_name;
  const address = String(s.provider.billing_address || "").replace(/\n/g, "<br>");
  const bank = [s.provider.bank_account_holder, s.provider.bank_name, s.provider.bank_account_number, s.provider.bank_account_type].filter(Boolean).map(html).join("<br>");
  const brand = /^#[0-9a-f]{6}$/i.test(s.provider.brand_primary_color || "") ? s.provider.brand_primary_color : "#087b5b";
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:11px Arial;color:#17352c;margin:0}.page{border:1px solid #d9e6df;padding:22px}.top{border-top:7px solid ${brand};padding-top:13px;display:flex;justify-content:space-between;gap:24px}.brand{max-width:58%}.logo{max-height:54px;max-width:175px;object-fit:contain;display:block;margin-bottom:8px}h1{font-size:20px;margin:0 0 4px;color:${brand}}p{margin:3px 0;line-height:1.35}.meta{text-align:right;min-width:190px}.title{font-size:19px;font-weight:700;margin:4px 0 20px;text-transform:uppercase}.account{display:flex;justify-content:space-between;border-bottom:2px solid ${brand};padding:8px 0 14px;margin-bottom:12px}.customer{font-size:14px;font-weight:700}.balance{display:flex;justify-content:flex-end;gap:25px;padding:12px;font-size:14px}.opening{background:#f1f8f5}.closing{margin-top:15px;background:#163d2b;color:#fff;font-size:16px}table{width:100%;border-collapse:collapse}th{background:#eaf7f2;color:#075f49;text-align:left;padding:9px;border:1px solid #cfe0d8}td{padding:8px;border:1px solid #dce8e3;vertical-align:top}.money{text-align:right}.bottom{display:flex;justify-content:space-between;gap:24px;margin-top:20px}.bank{font-size:10px;line-height:1.45}.bank b{font-size:11px}.note{font-size:10px;max-width:55%;color:#4c655b}</style></head><body><main class="page"><section class="top"><div class="brand">${s.provider.logo_url ? `<img class="logo" src="${html(s.provider.logo_url)}" alt="">` : ""}<h1>${html(providerName)}</h1><p>${address}</p><p>${html(s.provider.billing_phone || "")}</p><p>${html(s.provider.billing_email || "")}</p></div><div class="meta"><div class="title">Statement</div><p><b>Date:</b> ${html(s.to)}</p><p><b>Period:</b> ${html(s.from)} — ${html(s.to)}</p>${s.provider.practice_number ? `<p><b>Practice no.:</b> ${html(s.provider.practice_number)}</p>` : ""}${s.provider.medical_registration_number ? `<p><b>Registration:</b> ${html(s.provider.medical_registration_number)}</p>` : ""}</div></section><section class="account"><div><div class="customer">${html(s.customer.name)}</div><p>${html(s.customer.email || "")}</p><p>${html(s.customer.phone || "")}</p></div><div><b>Account statement</b><p>All invoices, payments and credits</p></div></section><div class="balance opening"><span>Opening balance</span><b>${html(formatMoney(s.openingBalance))}</b></div><table><thead><tr><th>Date</th><th>Transaction</th><th>Reference</th><th class="money">Debit</th><th class="money">Credit</th><th class="money">Balance</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No transactions during this period.</td></tr>'}</tbody></table><div class="balance closing"><span>Amount due / closing balance</span><b>${html(formatMoney(s.closingBalance))}</b></div><section class="bottom"><div class="bank">${bank ? `<b>Banking details</b><br>${bank}` : ""}</div><div class="note">${html(s.provider.remittance_instructions || "Please use the invoice reference when making payment.")}</div></section></main></body></html>`;
}
billingLedgerRouter.get(
  "/statements",
  authRequired(["admin", "provider"]),
  asyncHandler(async (req, res) => {
    await assertStatementAccess(req.user, String(req.query.providerId || ""));
    res.json({ statement: await buildStatement(req.query) });
  }),
);
billingLedgerRouter.get(
  "/statements/pdf",
  authRequired(["admin", "provider"]),
  asyncHandler(async (req, res) => {
    await assertStatementAccess(req.user, String(req.query.providerId || ""));
    const s = await buildStatement(req.query);
    const passwordDetails = await statementPdfPassword(req.query);
    const pdf = await passwordProtectPdf(
      await generateHtmlPdf(statementHtml(s)),
      passwordDetails.password,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("X-Statement-Password-Method", passwordDetails.method);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="statement-${s.from}-${s.to}.pdf"`,
    );
    res.send(pdf);
  }),
);
billingLedgerRouter.post(
  "/statements/email",
  authRequired(["admin", "provider"]),
  asyncHandler(async (req, res) => {
    await assertStatementAccess(req.user, String(req.body.providerId || ""));
    const s = await buildStatement(req.body);
    if (!s.customer.email) throw fail("The billing customer does not have an email address");
    const passwordDetails = await statementPdfPassword(req.body);
    const pdf = await passwordProtectPdf(
      await generateHtmlPdf(statementHtml(s)),
      passwordDetails.password,
    );
    await sendInvoiceEmail({
      email: s.customer.email,
      fullName: s.customer.name,
      subject: `Account statement from ${s.provider.registered_business_name || s.provider.full_name}`,
      message: `Please find your account statement for ${s.from} to ${s.to} attached. Closing balance: ${formatMoney(s.closingBalance)}.\n\nFor your privacy, the PDF is password protected. ${passwordDetails.guidance} The password is not included in this email.`,
      pdfBuffer: pdf,
      filename: `statement-${s.from}-to-${s.to}.pdf`,
      documentLabel: "statement",
    });
    await query(`INSERT INTO audit_logs(user_id,user_name,user_role,action,details) VALUES($1,$2,$3,'Emailed account statement',$4::jsonb)`, [req.user.id, actor(req.user), req.user.role, JSON.stringify({ providerId: req.body.providerId, customerId: req.body.customerId, customerType: req.body.customerType || "patient", from: s.from, to: s.to, email: s.customer.email })]);
    res.json({ success: true, message: `Statement emailed to ${s.customer.email}. ${passwordDetails.guidance}` });
  }),
);

billingLedgerRouter.post(
  "/statements/whatsapp",
  authRequired(["admin", "provider"]),
  asyncHandler(async (req, res) => {
    await assertStatementAccess(req.user, String(req.body.providerId || ""));
    const s = await buildStatement(req.body);
    if (!s.customer.phone) throw fail("The billing customer does not have a phone number");
    const passwordDetails = await statementPdfPassword(req.body);
    const providerName = s.provider.registered_business_name || s.provider.full_name;
    const message = [
      `Hello ${s.customer.name},`,
      `Your account statement from ${providerName} for ${s.from} to ${s.to} is ready.`,
      `Closing balance: ${formatMoney(s.closingBalance)}.`,
      `The PDF is password protected. ${passwordDetails.guidance}`,
    ].join("\n\n");
    await sendWhatsAppMsg({ phoneNumber: s.customer.phone, message });
    await query(
      `INSERT INTO audit_logs(user_id,user_name,user_role,action,details)
       VALUES($1,$2,$3,'Sent account statement via WhatsApp',$4::jsonb)`,
      [
        req.user.id,
        actor(req.user),
        req.user.role,
        JSON.stringify({
          providerId: req.body.providerId,
          customerId: req.body.customerId,
          customerType: req.body.customerType || "patient",
          from: s.from,
          to: s.to,
          phone: s.customer.phone,
        }),
      ],
    );
    res.json({
      success: true,
      message: `Statement details sent by WhatsApp to ${s.customer.phone}.`,
    });
  }),
);

billingLedgerRouter.get(
  "/audit",
  authRequired(["admin"]),
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id,user_name,user_role,action,details,created_at FROM audit_logs WHERE action ILIKE '%billing%' OR action ILIKE '%invoice%' OR action ILIKE '%credit note%' ORDER BY created_at DESC LIMIT 500`,
    );
    res.json({ history: result.rows });
  }),
);
