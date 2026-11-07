// Surveys, testimonial and referral asks. Filled in with the engagement features; nothing is planned until then.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import type { Settings } from './common.ts';

export async function planEngagement(_admin: SupabaseClient, _s: Settings, _tz: string, _trainer: string, _now: Date): Promise<number> {
  return 0;
}
