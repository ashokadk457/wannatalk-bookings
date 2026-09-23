export type Role = 'patient' | 'provider' | 'admin';
export type Status = 'Booked' | 'Confirmed' | 'Arrived' | 'Completed' | 'Cancelled' | 'No-show';
export const statuses: Status[] = ['Booked', 'Confirmed', 'Arrived', 'Completed', 'Cancelled', 'No-show'];
export interface User { id: string; fullName: string; email: string; mobile: string | null; role: Role; entityId: string | null; preferredContact: string | null; isActive: boolean }
export interface Availability { day_of_week: number; is_available: boolean; start_time: string; end_time: string }
export interface TimeBlock { id: string; block_date: string; start_time: string; end_time: string; reason: string }
export interface BusyTime { appointment_date: string; appointment_time: string; end_time: string }
export interface Provider { id: string; full_name: string; email: string; mobile: string | null; is_active: boolean; professional_title: string; default_duration_minutes: number; bio: string | null; is_online: boolean; locations: string[]; availability: Availability[]; blocks: TimeBlock[]; busy: BusyTime[] }
export interface Patient { id: string; full_name: string; email: string; mobile: string | null; preferred_contact: string | null; is_active: boolean }
export interface Appointment { id: string; provider_id: string; patient_id: string; location_id: string | null; appointment_date: string; appointment_time: string; duration_minutes: number; appointment_type: string; mode: string; status: Status; payment_status: string; note: string | null; intake_requested: boolean; patient_name: string; patient_email: string; patient_mobile: string | null; provider_name: string; provider_email: string; provider_mobile: string | null; professional_title: string; location_name: string | null }
export interface Location { id: string; name: string }
export interface Appointment { meeting_url?: string | null }
export interface Appointment { meeting_url?: string | null }
export interface Registration { id: string; full_name: string; email: string; mobile: string | null; role: Role; created_at: string; locations: string[] }
export interface AuditLog { id: string; user_name: string; user_role: Role; action: string; location_name: string | null; appointment_id: string | null; details: Record<string, unknown>; created_at: string }
export interface AppData { providers: Provider[]; patients: Patient[]; appointments: Appointment[]; locations: Location[]; registrations: Registration[]; auditLogs: AuditLog[] }
export interface Message { id: string; providerId: string; name: string; number: string; text: string; createdAt: string }
export interface RegistrationInput { role: Role; fullName: string; email: string; mobile: string; password: string; preferredContact: string; professionalTitle: string; durationMinutes: number; bio: string; locations: string[] }
export interface MfaChallenge { challengeId: string; purpose: 'login' | 'registration'; methods: { method: 'email' | 'sms'; label: string; destination: string }[]; unavailableMethods?: { label: string; reason: string }[] }
export interface RegistrationResult { status: 'approved' | 'pending' | 'verification_required'; message?: string; token?: string; user?: User; verificationRequired?: boolean; challengeId?: string; purpose?: 'login' | 'registration'; methods?: MfaChallenge['methods']; unavailableMethods?: MfaChallenge['unavailableMethods'] }
export interface LoginResult extends RegistrationResult { mfaRequired?: boolean }
export interface FollowUp { id: string; patient_id: string; provider_id: string; patient_name: string; provider_name: string; due_at: string; internal_note: string; reminder_message: string; reminder_channels: string[]; reminder_sent_at: string | null; status: 'open' | 'completed' | 'cancelled' }
export interface Delivery { id: string; patient_id: string; provider_id: string | null; patient_name: string; provider_name: string | null; channel: string; recipient: string; subject: string; message_text: string; status: string; error_message: string | null; sent_at: string | null; created_at: string }
export interface WaitingEntry { id: string; patient_name: string; provider_name: string | null; location_name: string | null; date_from: string; date_to: string; time_preference: string; notification_channels: string[]; status: string; notification_count: number; last_notified_at: string | null }
