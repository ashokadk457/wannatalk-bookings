import { useId, type ReactNode } from 'react';
import { statusClass } from '../lib/dates';
export function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  // Wrapping controls in the label preserves their accessible name without global IDs.
  return <label className={`field${full ? ' full' : ''}`}><span>{label}</span>{children}</label>;
}
export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) { return <article className={`card ${className}`}>{title && <div className="card-head"><h3>{title}</h3></div>}{children}</article>; }
export function Heading({ title, subtitle }: { title: string; subtitle?: string }) { return <div className="section-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>; }
export function Empty({ children = 'No records to show.' }: { children?: ReactNode }) { return <div className="empty">{children}</div>; }
export function StatusPill({ status }: { status: string }) { return <span className={`status ${statusClass(status)}`}>{status}</span>; }
export function ProviderStatus({ active, online }: { active: boolean; online: boolean }) { return <span className={`status ${!active ? 'cancelled' : online ? 'confirmed' : 'completed'}`}>{!active ? 'Inactive' : online ? 'Online' : 'Offline'}</span>; }
export function Stat({ label, value, note, color, icon }: { label: string; value: number; note: string; color: string; icon: string }) { return <article className="card stat-card"><div className={`icon ${color}`}>{icon}</div><div><small>{label}</small><b>{value}</b><span>{note}</span></div></article>; }
export function LocationFields({ value, onChange, locations = ['Centurion', 'Emalahleni', 'Online'] }: { value: string[]; onChange: (value: string[]) => void; locations?: string[] }) { const id = useId(); return <fieldset className="field full location-fields"><legend>Practice locations</legend><div className="actions">{locations.map(name => <label key={name} htmlFor={`${id}-${name}`}><input id={`${id}-${name}`} type="checkbox" checked={value.includes(name)} onChange={e => onChange(e.target.checked ? [...value, name] : value.filter(v => v !== name))} /> {name}</label>)}</div></fieldset>; }
