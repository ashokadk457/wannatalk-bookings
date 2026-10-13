import { NavLink } from 'react-router-dom';

export default function BillingNav() {
  return <nav className="billing-nav" aria-label="Billing sections">
    <NavLink to="/admin/billing/providers">Provider profiles</NavLink>
    <NavLink to="/admin/billing/companies">Companies</NavLink>
    <NavLink to="/admin/billing/invoices">Invoices</NavLink>
    <span title="Available in the next billing phase">Statements</span>
    <span title="Available in the next billing phase">Payments</span>
  </nav>;
}
