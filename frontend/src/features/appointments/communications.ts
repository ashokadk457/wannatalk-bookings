import type { Appointment, Message } from '../../types';
import { formatDate } from '../../lib/dates';
export function reminder(a: Appointment) { return `Hi ${a.patient_name || 'there'}, this is a reminder of your WannaTalk appointment with ${a.provider_name || 'your provider'} on ${formatDate(a.appointment_date)} at ${a.appointment_time} (${a.location_name || a.mode}). Please reply to confirm.`; }
export function whatsAppUrl(number: string | null, message: string) { const digits = String(number || '').replace(/\D/g, '').replace(/^0/, '27'); return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null; }
export function openWhatsApp(number: string | null, text: string) { const url = whatsAppUrl(number, text); if (!url) return false; window.open(url, '_blank', 'noopener,noreferrer'); return true; }
const key = (account: string) => `wannatalk:messages:${account}`;
export function readMessages(account: string): Message[] { try { const value = JSON.parse(localStorage.getItem(key(account)) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
export function queueReminders(account: string, appointments: Appointment[]) { const added: Message[] = appointments.map(a => ({ id: crypto.randomUUID(), providerId: a.provider_id, name: a.patient_name, number: a.patient_mobile || '', text: reminder(a), createdAt: new Date().toISOString() })); localStorage.setItem(key(account), JSON.stringify([...added, ...readMessages(account)].slice(0, 200))); return added; }
