// Shared by the outbox runner and the engagement planner.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { emailConfigured } from './email.ts';
import { smsConfigured } from './sms.ts';

export type Settings = {
  trainer_id: string; quiet_start: string; quiet_end: string; max_per_week: number; reminders_on: boolean; reminder_hours: number[];
  surveys_on: boolean; survey_every: number; survey_min_days: number; testimonials_on: boolean; referrals_on: boolean;
  referral_every_days: number; include_ca_clients: boolean; sms_enabled: boolean;
};
export type ClientRow = { id: string; trainer_id: string; user_id: string | null; first_name: string; email?: string | null; phone: string | null; status: string; client_of?: string | null };
export type Purpose = 'reminders' | 'offers' | 'surveys' | 'marketing';
export const ESSENTIAL: Purpose[] = ['reminders', 'offers'];

export async function allowed(admin: SupabaseClient, client: string, purpose: Purpose, channel: string): Promise<boolean> {
  const { data } = await admin.rpc('coach_contact_allowed', { p_client: client, p_purpose: purpose, p_channel: channel });
  return data === true;
}

/**
 * Best channel for this client and purpose. The client's preferred channel comes first (default: text, the one people
 * are least likely to miss), then text, email, chat. Text and email go out automatically when those services are on;
 * otherwise they wait in the trainer's "To send" list and go from the trainer's own phone or email. Each channel needs the client's consent for that purpose.
 */
export async function pickChannel(admin: SupabaseClient, s: Settings, c: ClientRow, purpose: Purpose): Promise<'sms' | 'email' | 'app' | 'manual' | 'manual_email' | null> {
  const { data: pref } = await admin.from('coach_contact_prefs').select('preferred_channel').eq('client_id', c.id).maybeSingle();
  const order = [...new Set([(pref?.preferred_channel as string | undefined) ?? 'sms', 'sms', 'email', 'app'])];
  for (const ch of order) {
    if (ch === 'sms' && c.phone && await allowed(admin, c.id, purpose, 'sms')) return s.sms_enabled && smsConfigured() ? 'sms' : 'manual';
    if (ch === 'email' && c.email && await allowed(admin, c.id, purpose, 'email')) return emailConfigured() ? 'email' : 'manual_email';
    if (ch === 'app' && c.user_id && c.status === 'active' && await allowed(admin, c.id, purpose, 'app')) return 'app';
  }
  return null;
}

export const skipCa = (s: Settings, c: ClientRow) => c.client_of === 'ca' && !s.include_ca_clients;
