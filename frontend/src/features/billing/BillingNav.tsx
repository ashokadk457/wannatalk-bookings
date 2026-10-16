import { NavLink } from 'react-router-dom';

export default function BillingNav() {
  return <nav className="billing-nav" aria-label="Billing sections">
    <NavLink to="/admin/billing/overview">Overview</NavLink>
    <NavLink to="/admin/billing/providers">Provider profiles</NavLink>
    <NavLink to="/admin/billing/companies">Financially Responsible Party</NavLink>
    <NavLink to="/admin/billing/invoices">Invoices</NavLink>
    <NavLink to="/admin/billing/statements">Statements</NavLink>
    <NavLink to="/admin/billing/payments">Payments</NavLink>
    <NavLink to="/admin/billing/audit">Audit history</NavLink>
  </nav>;
}
