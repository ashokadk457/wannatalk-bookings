import { useApp } from '../../app/AppContext';
import { Card, Empty, Heading } from '../../components/ui';
export default function AuditPage() {
  const { data } = useApp();
  return (
    <section>
      <Heading
        title="Audit log"
        subtitle="User, location and action history for booking changes."
      />
      <Card>
        {data.auditLogs.length ? (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Date/time</th>
                  <th>User</th>
                  <th>Location</th>
                  <th>Action</th>
                  <th>Booking / details</th>
                </tr>
              </thead>
              <tbody>
                {data.auditLogs.map((log) => {
                  const a = data.appointments.find((a) => a.id === log.appointment_id);
                  return (
                    <tr key={log.id}>
                      <td>{new Date(log.created_at).toLocaleString('en-ZA')}</td>
                      <td>
                        <strong>{log.user_name}</strong>
                        <div className="sub">{log.user_role}</div>
                      </td>
                      <td>{log.location_name || a?.location_name || 'Server'}</td>
                      <td>{log.action}</td>
                      <td>
                        {a
                          ? `${a.patient_name} with ${a.provider_name} · ${a.appointment_date} ${a.appointment_time}`
                          : Object.entries(log.details || {})
                              .map(([key, value]) => `${key}: ${String(value)}`)
                              .join(' · ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No audit events yet.</Empty>
        )}
      </Card>
    </section>
  );
}
