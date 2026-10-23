import { NavLink } from 'react-router-dom';
import { useApp } from '../../app/AppContext';

export default function BillingNav() {
  const { user } = useApp();
  if (user?.role === 'provider') {
    return (
      <nav className="billing-nav" aria-label="Billing sections">
        <NavLink to="/provider/billing/overview">Overview</NavLink>
        <NavLink to="/provider/billing/profile">Billing &amp; bank details</NavLink>
        <NavLink to="/provider/billing/invoices">Invoices</NavLink>
        <NavLink to="/provider/billing/outstanding">Outstanding</NavLink>
      </nav>
    );
  }
  return (
    <nav className="billing-nav" aria-label="Billing sections">
      <NavLink to="/admin/billing/overview">Overview</NavLink>
      <NavLink to="/admin/billing/providers">Provider profiles</NavLink>
      <NavLink to="/admin/billing/default-bank">Default Bank</NavLink>
      <NavLink to="/admin/billing/companies">Financially Responsible Party</NavLink>
      <NavLink to="/admin/billing/invoices">Invoices</NavLink>
      <NavLink to="/admin/billing/outstanding">Outstanding</NavLink>
      <NavLink to="/admin/billing/statements">Statements</NavLink>
      <NavLink to="/admin/billing/payments">Payments</NavLink>
      <NavLink to="/admin/billing/audit">Audit history</NavLink>
    </nav>
  );
}
