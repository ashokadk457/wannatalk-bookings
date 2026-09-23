import { useApp } from '../../app/AppContext';
import Calendar from '../appointments/Calendar';
export default function CalendarPage() { const { data } = useApp(); return <Calendar appointments={data.appointments} />; }
