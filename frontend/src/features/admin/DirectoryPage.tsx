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
    </section>
  );
}
