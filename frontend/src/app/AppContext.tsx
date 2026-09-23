import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, getToken, mutate, setToken } from '../services/api';
import type {
  AppData,
  Appointment,
  AuditLog,
  Location,
  Patient,
  Provider,
  Registration,
  User,
  Role,
  LoginResult,
} from '../types';

const emptyData: AppData = {
  providers: [],
  patients: [],
  appointments: [],
  locations: [],
  registrations: [],
  auditLogs: [],
};
async function fetchData(user: User): Promise<AppData> {
  const [providers, patients, appointments, locations] = await Promise.all([
    api<{ providers: Omit<Provider, 'availability'>[] }>('/providers'),
    api<{ patients: Patient[] }>('/patients'),
    api<{ appointments: Appointment[] }>('/appointments'),
    api<{ locations: Location[] }>('/locations'),
  ]);
  const withAvailability = await Promise.all(
    providers.providers.map(async (p) => {
      const result = await api<Pick<Provider, 'availability' | 'blocks' | 'busy'>>(
        `/providers/${p.id}/availability`,
      );
      return {
        ...p,
        availability: result.availability,
        blocks: result.blocks || [],
        busy: result.busy || [],
      };
    }),
  );
  const [registrations, auditLogs] =
    user.role === 'admin'
      ? await Promise.all([
          api<{ registrations: Registration[] }>('/registrations'),
          api<{ auditLogs: AuditLog[] }>('/audit-logs'),
        ])
      : [{ registrations: [] }, { auditLogs: [] }];
  return {
    providers: withAvailability,
    patients: patients.patients,
    appointments: appointments.appointments.map((a) => ({
      ...a,
      appointment_date: a.appointment_date.slice(0, 10),
      appointment_time: a.appointment_time.slice(0, 5),
    })),
    locations: locations.locations,
    registrations: registrations.registrations,
    auditLogs: auditLogs.auditLogs,
  };
}
interface Context {
  user: User | null;
  data: AppData;
  loading: boolean;
  error: string;
  login: (email: string, password: string, role: Role) => Promise<LoginResult>;
  acceptSession: (token: string, user: User) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  retry: () => void;
  notify: (message: string) => void;
  run: (work: () => Promise<unknown>, success?: string) => Promise<boolean>;
}
const AppContext = createContext<Context | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [toast, setToast] = useState('');
  const generation = useRef(0);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(''), 5000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const logout = useCallback(() => {
    generation.current++;
    setToken(null);
    setUser(null);
    setData(emptyData);
    setError('');
    setLoading(false);
  }, []);
  const restore = useCallback(async () => {
    const version = ++generation.current;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { user: current } = await api<{ user: User | null }>('/auth/me');
      if (!current?.isActive) {
        logout();
        return;
      }
      const next = await fetchData(current);
      if (generation.current === version) {
        setUser(current);
        setData(next);
      }
    } catch (e) {
      if (generation.current === version) {
        if (e instanceof ApiError && e.status === 401) logout();
        else setError(e instanceof Error ? e.message : 'Unable to load account');
      }
    } finally {
      if (generation.current === version) setLoading(false);
    }
  }, [logout]);
  useEffect(() => {
    void restore();
    const expired = () => {
      logout();
      notify('Your session has expired. Please log in again.');
    };
    window.addEventListener('session-expired', expired);
    const storage = (e: StorageEvent) => {
      if (e.key === 'wannatalkApiToken') void restore();
    };
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('session-expired', expired);
      window.removeEventListener('storage', storage);
    };
  }, [restore, logout, notify]);
  async function acceptSession(token: string, current: User) {
    const version = ++generation.current;
    setToken(token);
    try {
      const next = await fetchData(current);
      if (generation.current === version) {
        setUser(current);
        setData(next);
        setError('');
      }
    } catch (e) {
      if (generation.current === version) logout();
      throw e;
    }
  }
  async function login(email: string, password: string, role: Role) {
    const result = await mutate<LoginResult>('/auth/login', 'POST', { email, password, role });
    if (result.token && result.user) await acceptSession(result.token, result.user);
    return result;
  }
  async function refresh() {
    if (!user) return;
    const version = generation.current;
    const { user: current } = await api<{ user: User }>('/auth/me');
    if (!current?.isActive) {
      logout();
      return;
    }
    const next = await fetchData(current);
    if (generation.current === version) {
      setUser(current);
      setData(next);
    }
  }
  async function run(work: () => Promise<unknown>, success?: string) {
    try {
      await work();
      if (success) notify(success);
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Something went wrong');
      return false;
    }
  }
  return (
    <AppContext.Provider
      value={{
        user,
        data,
        loading,
        error,
        login,
        acceptSession,
        logout,
        refresh,
        retry: () => void restore(),
        notify,
        run,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status" onClick={() => setToast('')}>
          {toast}
        </div>
      )}
    </AppContext.Provider>
  );
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppProvider missing');
  return context;
}
