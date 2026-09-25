import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Card, Empty, Field, Heading, ProviderStatus, StatusPill } from '../../components/ui';
import { mutate } from '../../services/api';
import AccountEditor from './AccountEditor';
import type { Patient, Provider } from '../../types';
export default function DirectoryPage({ providers = false }: { providers?: boolean }) {
  const { user, data, run, refresh } = useApp(),
    navigate = useNavigate();
  const [search, setSearch] = useState(''),
    [edit, setEdit] = useState<Patient | Provider | null>(null),
    [busy, setBusy] = useState(false),
    [activeFilter, setActiveFilter] = useState('');
  const [importResults, setImportResults] = useState<{ row: number; status: string; email: string; reason: string }[]>([]);
  function downloadCsv() {
    const headers = ['Title','First Name','Last Name','Email','Phone','South African ID / Passport','Date of Birth','Nationality','Preferred Contact','Pwd'];
    const lines = [headers, ...(!providers ? data.patients.map((p) => [p.title || '', p.first_name || p.full_name.split(' ')[0], p.last_name || p.full_name.split(' ').slice(1).join(' '), p.email, p.mobile || '', p.identity_document || '', p.date_of_birth || '', p.nationality || 'ZA', p.preferred_contact || 'Email', '']) : [])];
    const csv = lines.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = providers ? 'providers.csv' : 'patients.csv'; a.click(); URL.revokeObjectURL(url);
  }
  async function importCsv(file: File) {
    const text = await file.text(), [head, ...body] = text.trim().split(/\r?\n/).map((line) => line.split(',').map((v) => v.replace(/^"|"$/g, '').replaceAll('""', '"')));
    const rows = body.filter((r) => r.length).map((r) => Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase().replaceAll(' ', ''), r[i] || ''])));
    await run(async () => { const result = await mutate<{ created: string[]; errors: { row: number; error: string }[] }>('/patients/import', 'POST', { rows: rows.map((r) => ({ title: r.title, firstName: r.firstname, lastName: r.lastname, email: r.email, mobile: r.phone, identityDocument: r['southafricanid/passport'], dateOfBirth: r.dateofbirth, nationality: r.nationality, preferredContact: r.preferredcontact, pwd: r.pwd })) }); setImportResults([...result.created.map((email) => ({ row: 0, status: 'Success', email, reason: 'Imported successfully' })), ...result.errors.map((e) => ({ row: e.row, status: 'Failed', email: '', reason: e.error }))]); await refresh(); }, 'Import complete');
  }
  const admin = user?.role === 'admin',
    source = providers ? data.providers : data.patients;
  const rows = source
    .filter(
      (a) =>
        (!activeFilter || (activeFilter === 'active') === a.is_active) &&
        [
          a.full_name,
          a.email,
          a.mobile,
          'professional_title' in a ? a.professional_title : '',
        ].some((v) => v?.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  async function toggle(account: Patient | Provider) {
    const action = account.is_active ? 'deactivate' : 'reactivate';
    if (
      !window.confirm(
        `${action === 'deactivate' ? 'Deactivate' : 'Reactivate'} ${account.full_name}?`,
      )
    )
      return;
    setBusy(true);
    await run(async () => {
      await mutate(`/${providers ? 'providers' : 'patients'}/${account.id}/${action}`, 'PATCH');
      await refresh();
    }, `Account ${action}d`);
    setBusy(false);
  }
  return (
    <section>
      <Heading
        title={providers ? 'Registered providers' : admin ? 'Patients' : 'My patients'}
        subtitle={
          providers
            ? 'View, update, deactivate, or reactivate provider accounts.'
            : 'Contact details and appointment history.'
        }
      />
      <Card>
        <div className="admin-filters">
          <Field label={providers ? 'Search providers' : 'Search patients'}>
            <input
              type="search"
              placeholder="Name, email, mobile or title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field label="Account status">
            <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
              <option value="">All accounts</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <span className="pill">
            {source.filter((a) => a.is_active).length} active · {source.length} total
          </span>
          {admin && !providers && <div className="actions"><button type="button" className="btn secondary small" onClick={downloadCsv}>Export patients</button><button type="button" className="btn secondary small" onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.csv,text/csv'; input.onchange = () => input.files?.[0] && void importCsv(input.files[0]); input.click(); }}>Import CSV/Excel</button></div>}
        </div>
        {rows.length ? (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>{providers ? 'Provider' : 'Patient'}</th>
                  <th>Contact</th>
                  <th>{providers ? 'Locations' : 'Latest booking'}</th>
                  <th>Appointments</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((account) => {
                  const p = 'professional_title' in account ? account : null,
                    apps = data.appointments.filter((a) =>
                      providers ? a.provider_id === account.id : a.patient_id === account.id,
                    ),
                    latest = apps
                      .map((a) => a.appointment_date)
                      .sort()
                      .at(-1);
                  return (
                    <tr key={account.id}>
                      <td>
                        <strong>{account.full_name}</strong>
                        {p && (
                          <div className="sub">
                            {p.professional_title} · {p.default_duration_minutes} minutes
                          </div>
                        )}
                      </td>
                      <td>
                        {account.email}
                        <div className="sub">{account.mobile || 'No mobile'}</div>
                      </td>
                      <td>{p ? p.locations.join(', ') : latest || '—'}</td>
                      <td>
                        {apps.length}
                        {p && (
                          <div className="sub">
                            {new Set(apps.map((a) => a.patient_id)).size} patients
                          </div>
                        )}
                      </td>
                      <td>
                        {p ? (
                          <ProviderStatus active={p.is_active} online={p.is_online} />
                        ) : (
                          <StatusPill status={account.is_active ? 'Active' : 'Inactive'} />
                        )}
                      </td>
                      <td>
                        <div className="actions">
                          {admin && (
                            <>
                              <button
                                className="btn secondary small"
                                onClick={() => setEdit(account)}
                              >
                                Edit
                              </button>
                              <button
                                disabled={busy}
                                className={`btn small ${account.is_active ? 'danger' : ''}`}
                                onClick={() => void toggle(account)}
                              >
                                {account.is_active ? 'Deactivate' : 'Reactivate'}
                              </button>
                            </>
                          )}
                          {p ? (
                            <button
                              className="btn secondary small"
                              onClick={() =>
                                navigate('/admin/availability', { state: { providerId: p.id } })
                              }
                            >
                              Calendar
                            </button>
                          ) : (
                            <>
                              <button
                                className="btn secondary small"
                                onClick={() =>
                                  navigate(`/${user?.role}/messages`, {
                                    state: { patientId: account.id },
                                  })
                                }
                              >
                                Message
                              </button>
                              <button
                                className="btn secondary small"
                                onClick={() =>
                                  navigate(`/${user?.role}/followups`, {
                                    state: { patientId: account.id },
                                  })
                                }
                              >
                                Follow-up
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No accounts match this search.</Empty>
        )}
      </Card>
      {edit && <AccountEditor account={edit} onClose={() => setEdit(null)} />}
      {importResults.length > 0 && <Card title="Import results" className="space-top"><table><thead><tr><th>Row</th><th>Email</th><th>Result</th><th>Reason</th></tr></thead><tbody>{importResults.map((result, index) => <tr key={`${result.row}-${index}`}><td>{result.row || '—'}</td><td>{result.email || '—'}</td><td><StatusPill status={result.status} /></td><td>{result.reason}</td></tr>)}</tbody></table></Card>}
    </section>
  );
}

