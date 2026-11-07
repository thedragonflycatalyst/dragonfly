// Plans surveys, testimonial asks and referral asks for one trainer (only the ones they switched on, only to clients
// who said yes to those messages, never to Columbia Association clients unless included). Each ask is timed to a good
// moment: a milestone or a top survey score. At most one ask of each kind per client per period (dedupe keys).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';
import { pickChannel, skipCa, type ClientRow, type Settings } from './common.ts';

const WEB = (Deno.env.get('DRAGONFLY_WEB_URL') ?? 'https://thedragonflycatalyst.github.io/dragonfly/').replace(/\/?$/, '/');
const DAY = 86_400_000;

export const surveyText = (first: string, trainer: string, link: string, sms: boolean) =>
  `Hi ${first}, quick one from ${trainer}: how is training going, 1–5?${sms ? ' Reply with a number, or' : ''} tap to answer: ${link}`;
export const testimonialText = (first: string, trainer: string, why: string, link: string) =>
  `${why} ${first}! Would you share a sentence or two about training with ${trainer}? You choose the words and how your name shows: ${link}`;
export const referralText = (first: string, trainer: string, link: string) =>
  `Thanks for training with ${trainer}, ${first}. Know someone who'd enjoy it? Share your link and they can get in touch: ${link}`;

const MILESTONE_WHY: Record<string, string> = { first_pr: 'Congrats on your first personal record,' };
export function whyText(key: string): string {
  if (MILESTONE_WHY[key]) return MILESTONE_WHY[key];
  const [kind, n] = key.split(':');
  if (kind === 'sessions') return `Congrats on ${n} sessions,`;
  if (kind === 'streak') return `${n} weeks in a row,`;
  return 'Great work lately,';
}
/** Milestones worth celebrating with an ask (not the very first session) */
export const askWorthy = (key: string) => key === 'first_pr' || /^sessions:(10|25|50|75|100|\d*[05]0)$/.test(key) || /^streak:(8|12|26|52)$/.test(key);

async function enqueue(admin: SupabaseClient, row: Record<string, unknown>): Promise<boolean> {
  const { error } = await admin.from('coach_outbox').insert(row);
  return !error;   // a duplicate dedupe_key means it was already planned
}

export async function planEngagement(admin: SupabaseClient, s: Settings, _tz: string, trainer: string, now: Date): Promise<number> {
  if (!s.surveys_on && !s.testimonials_on && !s.referrals_on) return 0;
  const { data: list } = await admin.from('coach_clients').select('*').eq('trainer_id', s.trainer_id).eq('status', 'active');
  const clients = ((list ?? []) as ClientRow[]).filter((c) => !skipCa(s, c));
  let n = 0;
  for (const c of clients) {
    // ---- surveys: every N sessions, not more often than survey_min_days
    if (s.surveys_on) {
      const { data: last } = await admin.from('coach_outbox').select('created_at').eq('client_id', c.id).eq('kind', 'survey').order('created_at', { ascending: false }).limit(1);
      const since = last?.[0]?.created_at ?? '1970-01-01T00:00:00Z';
      if (now.getTime() - new Date(since).getTime() >= s.survey_min_days * DAY) {
        const { count } = await admin.from('coach_logs').select('id', { count: 'exact', head: true }).eq('client_id', c.id).gt('performed_at', since);
        if ((count ?? 0) >= s.survey_every) {
          const channel = await pickChannel(admin, s, c, 'surveys');
          if (channel) {
            const token = crypto.randomUUID();
            n += Number(await enqueue(admin, {
              trainer_id: s.trainer_id, client_id: c.id, purpose: 'surveys', kind: 'survey', channel, token,
              body: surveyText(c.first_name, trainer, `${WEB}s/${token}`, channel === 'sms'), dedupe_key: `survey:${c.id}:${now.toISOString().slice(0, 10)}`,
            }));
          }
        }
      }
    }
    // ---- testimonial ask: after a milestone or a 5 in a survey; at most once per 90 days
    if (s.testimonials_on) {
      const recent = new Date(now.getTime() - 3 * DAY).toISOString();
      const [{ data: ms }, { data: fives }, { data: asked }] = await Promise.all([
        admin.from('coach_milestones').select('key, achieved_at').eq('client_id', c.id).gte('achieved_at', recent).order('achieved_at', { ascending: false }),
        admin.from('coach_survey_responses').select('id, comment').eq('client_id', c.id).eq('rating', 5).gte('created_at', recent).limit(1),
        admin.from('coach_testimonials').select('id').eq('client_id', c.id).gte('created_at', new Date(now.getTime() - 90 * DAY).toISOString()).limit(1),
      ]);
      const milestone = (ms ?? []).find((m: { key: string }) => askWorthy(m.key))?.key ?? null;
      if (!asked?.length && (milestone || fives?.length)) {
        const channel = await pickChannel(admin, s, c, 'marketing');
        if (channel) {
          const { data: t } = await admin.from('coach_testimonials').insert({
            client_id: c.id, trainer_id: s.trainer_id, source: milestone ? 'ask' : 'survey', milestone,
            body: fives?.[0]?.comment ?? null,   // their survey comment pre-fills the draft; they still edit and approve it
          }).select('token').single();
          if (t) n += Number(await enqueue(admin, {
            trainer_id: s.trainer_id, client_id: c.id, purpose: 'marketing', kind: 'testimonial_ask', channel,
            body: testimonialText(c.first_name, trainer, milestone ? whyText(milestone) : 'Thanks for the great feedback,', `${WEB}t/${t.token}`),
            dedupe_key: `testimonial:${c.id}:${milestone ?? 'survey'}:${now.toISOString().slice(0, 7)}`, related: { testimonial_token: t.token },
          }));
        }
      }
    }
    // ---- referral ask: after a published testimonial or a 5, at most every referral_every_days
    if (s.referrals_on) {
      const recent = new Date(now.getTime() - 7 * DAY).toISOString();
      const [{ data: pub }, { data: five }, { data: lastAsk }] = await Promise.all([
        admin.from('coach_testimonials').select('id').eq('client_id', c.id).eq('status', 'published').gte('published_at', recent).limit(1),
        admin.from('coach_survey_responses').select('id').eq('client_id', c.id).eq('rating', 5).gte('created_at', recent).limit(1),
        admin.from('coach_outbox').select('created_at').eq('client_id', c.id).eq('kind', 'referral_ask').order('created_at', { ascending: false }).limit(1),
      ]);
      const due = !lastAsk?.length || now.getTime() - new Date(lastAsk[0].created_at).getTime() >= s.referral_every_days * DAY;
      if (due && (pub?.length || five?.length)) {
        const channel = await pickChannel(admin, s, c, 'marketing');
        if (channel) {
          const { data: code } = await admin.rpc('coach_referral_code', { p_client: c.id });
          if (code) n += Number(await enqueue(admin, {
            trainer_id: s.trainer_id, client_id: c.id, purpose: 'marketing', kind: 'referral_ask', channel,
            body: referralText(c.first_name, trainer, `${WEB}r/${code}`), dedupe_key: `referral:${c.id}:${now.toISOString().slice(0, 10)}`,
          }));
        }
      }
    }
  }
  return n;
}
