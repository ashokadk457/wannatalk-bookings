import { useApp } from '../../app/AppContext';
import { Card, Empty } from '../../components/ui';
import Calendar from '../appointments/Calendar';
import AppointmentTable from '../appointments/AppointmentTable';
export default function AppointmentsPage() {
  const { data } = useApp();
  const appointments = [...data.appointments].sort((a, b) =>
    (b.appointment_date + b.appointment_time).localeCompare(
      a.appointment_date + a.appointment_time,
    ),
  );
  return (
    <section>
      {appointments.length ? (
        <>
          <Calendar appointments={appointments} />
          <Card className="space-top">
            <AppointmentTable appointments={appointments} />
          </Card>
        </>
      ) : (
        <Empty>You have no appointments yet.</Empty>
      )}
    </section>
  );
}
