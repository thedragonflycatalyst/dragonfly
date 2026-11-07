// Shared by the outbox runner and the engagement planner.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { smsConfigured } from './sms.ts';

export type Settings = {
  trainer_id: string; quiet_start: string; quiet_end: string; max_per_week: number; reminders_on: boolean; reminder_hours: number[];
  surveys_on: boolean; survey_every: number; survey_min_days: number; testimonials_on: boolean; referrals_on: boolean;
  referral_every_days: number; include_ca_clients: boolean; sms_enabled: boolean;
};
export type ClientRow = { id: string; trainer_id: string; user_id: string | null; first_name: string; phone: string | null; status: string; client_of?: string | null };
export type Purpose = 'reminders' | 'offers' | 'surveys' | 'marketing';
export const ESSENTIAL: Purpose[] = ['reminders', 'offers'];

export async function allowed(admin: SupabaseClient, client: string, purpose: Purpose, channel: string): Promise<boolean> {
  const { data } = await admin.rpc('coach_contact_allowed', { p_client: client, p_purpose: purpose, p_channel: channel });
  return data === true;
}

/** Best channel for this client and purpose: text (if switched on and agreed), chat (if they use the app), else the trainer's phone */
export async function pickChannel(admin: SupabaseClient, s: Settings, c: ClientRow, purpose: Purpose): Promise<'sms' | 'app' | 'manual' | null> {
  if (s.sms_enabled && smsConfigured() && c.phone && await allowed(admin, c.id, purpose, 'sms')) return 'sms';
  if (c.user_id && c.status === 'active' && await allowed(admin, c.id, purpose, 'app')) return 'app';
  // The trainer texting from their own phone: fine for reminders and offers; anything else needs the client's yes
  if (c.phone && (ESSENTIAL.includes(purpose) || await allowed(admin, c.id, purpose, 'sms'))) return 'manual';
  return null;
}

export const skipCa = (s: Settings, c: ClientRow) => c.client_of === 'ca' && !s.include_ca_clients;

