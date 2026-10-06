import { useApp } from '../../app/AppContext';
import { Empty, Heading } from '../../components/ui';
import AvailabilityEditor from './AvailabilityEditor';
export default function AvailabilityPage() {
  const { user, data } = useApp();
  const provider = data.providers.find((p) => p.id === user?.entityId);
  return <section><Heading title="Availability" subtitle="Manage weekly locations, working hours, holidays and unavailable periods." />{provider ? <AvailabilityEditor provider={provider}/> : <Empty>Provider profile not found.</Empty>}</section>;
}
