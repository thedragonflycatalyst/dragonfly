// Open follow-ups (e.g. "Reschedule Susan in ClubAutomation …") nag the trainer's phone every hour, 8 AM–9 PM their
// time, until they mark them done in the app.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { FOLLOWUP_TITLE, followupBody, followupDue, pushConfigured, sendUrgent } from '../_shared/push.ts';

const WEB = (Deno.env.get('DRAGONFLY_WEB_URL') ?? 'https://thedragonflycatalyst.github.io/dragonfly/').replace(/\/?$/, '/');

export async function processFollowups(admin: SupabaseClient, now: Date): Promise<number> {
  if (!pushConfigured()) return 0;
  const { data: rows } = await admin.from('coach_followups').select('id, trainer_id, title, alerts, last_alert_at').eq('status', 'open').limit(200);
  if (!rows?.length) return 0;
  const ids = [...new Set(rows.map((r) => r.trainer_id as string))];
  const [{ data: ts }, { data: toks }] = await Promise.all([
    admin.from('coach_trainers').select('user_id, timezone').in('user_id', ids),
    admin.from('coach_push_tokens').select('user_id, token, platform').in('user_id', ids),
  ]);
  let n = 0;
  for (const f of rows) {
    const tz = (ts ?? []).find((t) => t.user_id === f.trainer_id)?.timezone || 'America/New_York';
    if (!followupDue(f.last_alert_at ? new Date(f.last_alert_at) : null, now, tz)) continue;
    const mine = (toks ?? []).filter((t) => t.user_id === f.trainer_id).map((t) => ({ token: t.token as string, platform: t.platform as 'android' | 'ios' }));
    if (!mine.length) continue;
    const r = await sendUrgent(mine, FOLLOWUP_TITLE, followupBody(f.title), `${WEB}followups`, 'followup');
    if (r.dead.length) await admin.from('coach_push_tokens').delete().in('token', r.dead);
    await admin.from('coach_followups').update({ alerts: (f.alerts ?? 0) + 1, last_alert_at: now.toISOString() }).eq('id', f.id);
    n += r.sent;
  }
  return n;
}
