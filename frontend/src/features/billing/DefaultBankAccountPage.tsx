import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Field, Heading } from '../../components/ui';
import { api, mutate } from '../../services/api';
import BillingNav from './BillingNav';

interface DefaultBankAccount {
  bankAccountHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountType: string;
  bankBranchCode: string;
}

export default function DefaultBankAccountPage() {
  const { run, notify } = useApp();
  const [bank, setBank] = useState<DefaultBankAccount | null>(null);

  useEffect(() => {
    let active = true;
    api<{ bankAccount: DefaultBankAccount }>('/invoices/settings/default-bank')
      .then((result) => {
        if (active) setBank(result.bankAccount);
      })
      .catch((error) => {
        if (active)
          notify(error instanceof Error ? error.message : 'Unable to load default bank account');
      });
    return () => {
      active = false;
    };
  }, [notify]);

  const update = (key: keyof DefaultBankAccount, value: string) =>
    setBank((current) => (current ? { ...current, [key]: value } : current));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!bank) return;
    await run(async () => {
      const result = await mutate<{ bankAccount: DefaultBankAccount }>(
        '/invoices/settings/default-bank',
        'PUT',
        {
          accountHolder: bank.bankAccountHolder,
          bankName: bank.bankName,
          accountNumber: bank.bankAccountNumber,
          accountType: bank.bankAccountType,
          branchCode: bank.bankBranchCode,
        },
      );
      setBank(result.bankAccount);
    }, 'Default bank account saved');
  }

  return (
    <section>
      <Heading
        title="Default Bank Account"
        subtitle="Manage the fallback payment account shown when a provider has no bank details."
      />
      <BillingNav />
      <Card className="space-top">
        {bank ? (
          <form onSubmit={save}>
            <div className="notice">
              These details are used on new and existing invoices only when the selected provider's
              corresponding bank details are empty.
            </div>
            <div className="form-grid space-top">
              <Field label="Account holder">
                <input
                  required
                  value={bank.bankAccountHolder}
                  onChange={(event) => update('bankAccountHolder', event.target.value)}
                />
              </Field>
              <Field label="Bank">
                <input
                  required
                  value={bank.bankName}
                  onChange={(event) => update('bankName', event.target.value)}
                />
              </Field>
              <Field label="Account number">
                <input
                  required
                  value={bank.bankAccountNumber}
                  onChange={(event) => update('bankAccountNumber', event.target.value)}
                />
              </Field>
              <Field label="Account type">
                <select
                  required
                  value={bank.bankAccountType}
                  onChange={(event) => update('bankAccountType', event.target.value)}
                >
                  <option value="">Select account type</option>
                  <option value="CHEQUE ACCOUNT">Cheque Account</option>
                  <option value="CURRENT ACCOUNT">Current Account</option>
                  <option value="SAVINGS ACCOUNT">Savings Account</option>
                </select>
              </Field>
              <Field label="Branch code">
                <input
                  value={bank.bankBranchCode}
                  onChange={(event) => update('bankBranchCode', event.target.value)}
                />
              </Field>
            </div>
            <button className="btn space-top">Save default bank account</button>
          </form>
        ) : (
          <p>Loading default bank account…</p>
        )}
      </Card>
    </section>
  );
}
