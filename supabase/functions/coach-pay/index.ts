// coach-pay: Stripe payments for packages and events, and the trainer's Financials numbers.
//
// POST { action, ... }  (Authorization: the signed-in user's session)
//   checkout  { package_id | event_id, voucher? }  client → { url }   Stripe Checkout (one-off or subscription)
//   confirm   { session_id }                        anyone → { status }  records a finished checkout (idempotent)
//   sync      {}                                    trainer → { recorded } records any finished checkouts not yet saved
//   overview  {}                                    trainer → { balance, payouts, subscriptions } live from Stripe (owner only)
//   cancel_subscription { subscription_id }         trainer → { ok }
//   refund    { payment_id }                        trainer → { ok }
// Payments go to the Dragonfly owner's Stripe account (STRIPE_SECRET_KEY), so online payments are only offered
// to the owner and trainers on the owner's team. Everyone else records payments by hand in the app.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dragonfly-trainer, x-dragonfly-edit',
  'Access-Control-Max-Age': '86400',
};
const headers = { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const UUID = /^[0-9a-f-]{36}$/i;
const WEB = Deno.env.get('DRAGONFLY_WEB_URL') ?? 'https://thedragonflycatalyst.github.io/dragonfly/';

// Stripe REST with form encoding (nested keys like line_items[0][price_data][currency])
function form(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v as Record<string, unknown>, key, out); else out.append(key, String(v));
  }
  return out;
}
async function stripe(path: string, method = 'GET', body?: Record<string, unknown>) {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('not_configured');
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body ? form(body) : undefined,
  });
  const out = await res.json();
  if (!res.ok) { console.error('stripe', path, res.status, out?.error?.message); throw new Error(out?.error?.code || 'stripe_error'); }
  return out;
}

// Online payments are for the Dragonfly owner and their team's trainers
async function stripeAllowed(admin: SupabaseClient, trainerId: string) {
  const { data: owners } = await admin.from('dragonfly_admins').select('user_id');
  const ids = (owners ?? []).map((o) => o.user_id);
  if (ids.includes(trainerId)) return true;
  const { data: teams } = await admin.from('coach_teams').select('id').in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  if (!teams?.length) return false;
  const { data: m } = await admin.from('coach_team_members').select('id').in('team_id', teams.map((t) => t.id)).eq('trainer_id', trainerId).eq('status', 'active').maybeSingle();
  return !!m;
}

const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

// Saves a paid checkout: payment, the client's credits or event place, voucher use, included programs and plans
async function record(admin: SupabaseClient, s: Record<string, any>): Promise<'recorded' | 'already' | 'unpaid'> {
  if (s.status !== 'complete' || (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required')) return 'unpaid';
  const md = s.metadata ?? {};
  if (!UUID.test(md.trainer_id ?? '') || !UUID.test(md.client_id ?? '')) return 'unpaid';
  const { data: existing } = await admin.from('coach_payments').select('id').eq('stripe_session_id', s.id).maybeSingle();
  if (existing) return 'already';
  const { data: pay, error } = await admin.from('coach_payments').insert({
    trainer_id: md.trainer_id, client_id: md.client_id, package_id: md.package_id || null, event_id: md.event_id || null,
    description: String(md.description || 'Payment').slice(0, 200), amount_cents: s.amount_total ?? 0, currency: s.currency ?? 'usd',
    status: 'paid', method: 'stripe', stripe_session_id: s.id, stripe_payment_intent: s.payment_intent ?? null,
    stripe_subscription_id: s.subscription ?? null, voucher_id: md.voucher_id || null, paid_at: new Date((s.created ?? Date.now() / 1000) * 1000).toISOString(),
  }).select('id').single();
  if (error) { if (/duplicate/.test(error.message)) return 'already'; throw error; }
  if (md.voucher_id) {
    const { data: v } = await admin.from('coach_vouchers').select('uses').eq('id', md.voucher_id).maybeSingle();
    if (v) await admin.from('coach_vouchers').update({ uses: v.uses + 1 }).eq('id', md.voucher_id);
  }
  if (md.package_id) {
    const { data: p } = await admin.from('coach_packages').select('*').eq('id', md.package_id).maybeSingle();
    if (p) {
      await admin.from('coach_client_packages').insert({
        trainer_id: p.trainer_id, client_id: md.client_id, package_id: p.id, name: p.name, credits_total: p.credits,
        expires_on: p.valid_days ? addDays(p.valid_days) : null, billing: p.billing, payment_id: pay.id, stripe_subscription_id: s.subscription ?? null,
      });
      await admin.from('coach_packages').update({ sold: p.sold + 1 }).eq('id', p.id);
      for (const plan of p.plan_ids ?? []) await admin.from('coach_nutrition_plan_clients').upsert({ plan_id: plan, client_id: md.client_id, trainer_id: p.trainer_id }, { onConflict: 'plan_id,client_id' });
      // Programs start on the next Monday
      const d = new Date(); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
      for (const prog of p.program_ids ?? []) await assignProgram(admin, p.trainer_id, prog, md.client_id, d.toISOString().slice(0, 10));
    }
  }
  if (md.event_id) {
    // If it filled up or was cancelled while they paid, they go on the waiting list (paid) and the trainer can refund
    const { data: e } = await admin.from('coach_events').select('spaces, booked, cancelled').eq('id', md.event_id).maybeSingle();
    const full = !e || e.cancelled || (e.spaces != null && e.booked >= e.spaces);
    await admin.from('coach_event_signups').upsert({ event_id: md.event_id, client_id: md.client_id, trainer_id: md.trainer_id, status: full ? 'waitlist' : 'booked', paid: true }, { onConflict: 'event_id,client_id' });
  }
  return 'recorded';
}

// Same as coach_assign_program, done here because the service role has no "acting trainer"
async function assignProgram(admin: SupabaseClient, trainerId: string, programId: string, clientId: string, start: string) {
  const { data: prog } = await admin.from('coach_programs').select('*').eq('id', programId).eq('trainer_id', trainerId).maybeSingle();
  if (!prog) return;
  const day = (w: number, d: number) => { const x = new Date(`${start}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + (w - 1) * 7 + (d - 1)); return x.toISOString().slice(0, 10); };
  for (const s of prog.schedule ?? []) {
    const kind = s.kind ?? 'workout';
    if (kind === 'workout') {
      const { data: w } = await admin.from('coach_workouts').select('id, name, blocks').eq('id', s.workout_id).eq('trainer_id', trainerId).maybeSingle();
      if (w) await admin.from('coach_assignments').insert({ trainer_id: trainerId, client_id: clientId, workout_id: w.id, program_id: prog.id, scheduled_on: day(s.week, s.day), title: w.name, snapshot: w.blocks });
    } else if (['measurements', 'photo', 'note'].includes(kind)) {
      await admin.from('coach_tasks').insert({ trainer_id: trainerId, client_id: clientId, program_id: prog.id, due_on: day(s.week, s.day), kind,
        title: s.title || (kind === 'measurements' ? 'Update your measurements' : kind === 'photo' ? 'Upload a progress photo' : 'Note from your trainer'), details: s.details || null });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const url = Deno.env.get('SUPABASE_URL'), adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !adminKey) return reply(503, { error: 'unavailable' });
  if (!Deno.env.get('STRIPE_SECRET_KEY')) return reply(501, { error: 'not_configured' });
  const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: me } = await admin.auth.getUser(jwt);
  if (!me?.user) return reply(401, { error: 'sign_in_required' });
  const uid = me.user.id;
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return reply(400, { error: 'bad_request' }); }

  // Which trainer's books: yours, or (owners only) the team trainer you're viewing
  const trainerFor = async () => {
    const viewing = req.headers.get('x-dragonfly-trainer');
    if (viewing && viewing !== uid && UUID.test(viewing)) {
      const { data: team } = await admin.from('coach_teams').select('id').eq('owner_id', uid).maybeSingle();
      const { data: m } = team ? await admin.from('coach_team_members').select('id').eq('team_id', team.id).eq('trainer_id', viewing).eq('status', 'active').maybeSingle() : { data: null };
      return m ? viewing : null;
    }
    const { data: t } = await admin.from('coach_trainers').select('user_id').eq('user_id', uid).maybeSingle();
    return t ? uid : null;
  };

  try {
    switch (body.action) {
      case 'checkout': {
        const isPkg = UUID.test(body.package_id ?? ''), isEvt = UUID.test(body.event_id ?? '');
        if (isPkg === isEvt) return reply(400, { error: 'bad_request' });
        const { data: item } = isPkg ? await admin.from('coach_packages').select('*').eq('id', body.package_id).maybeSingle()
          : await admin.from('coach_events').select('*').eq('id', body.event_id).maybeSingle();
        if (!item) return reply(404, { error: 'not_found' });
        const { data: client } = await admin.from('coach_clients').select('id, email, name').eq('trainer_id', item.trainer_id).eq('user_id', uid).eq('status', 'active').maybeSingle();
        if (!client) return reply(403, { error: 'not_your_trainer' });
        if (!(await stripeAllowed(admin, item.trainer_id))) return reply(409, { error: 'online_payments_off' });
        let price: number, billing = 'once', name: string;
        if (isPkg) {
          const today = new Date().toISOString().slice(0, 10);
          if (item.archived || !item.visible || (item.client_ids?.length && !item.client_ids.includes(client.id))) return reply(404, { error: 'not_found' });
          if ((item.available_from && item.available_from > today) || (item.available_until && item.available_until < today)) return reply(409, { error: 'not_available' });
          if (item.max_sales && item.sold >= item.max_sales) return reply(409, { error: 'sold_out' });
          price = item.price_cents; billing = item.billing; name = item.name;
        } else {
          if (!item.visible || item.cancelled || !item.price_cents || new Date(item.starts_at) < new Date()) return reply(409, { error: 'not_available' });
          if (item.spaces && item.booked >= item.spaces) return reply(409, { error: 'event_full' });
          price = item.price_cents; name = item.title;
        }
        let voucherId: string | null = null;
        if (body.voucher && isPkg) {
          const code = String(body.voucher).trim().toUpperCase();
          const { data: v } = await admin.from('coach_vouchers').select('*').eq('trainer_id', item.trainer_id).eq('code', code).eq('active', true).maybeSingle();
          const today = new Date().toISOString().slice(0, 10);
          if (!v || (v.expires_on && v.expires_on < today) || (v.max_uses && v.uses >= v.max_uses) || (v.package_ids?.length && !v.package_ids.includes(item.id))) return reply(409, { error: 'voucher_invalid' });
          price = v.percent_off ? Math.round(price * (100 - v.percent_off) / 100) : Math.max(price - v.amount_off_cents, 0);
          voucherId = v.id;
        }
        if (price < 50) return reply(409, { error: 'price_too_low' });  // Stripe's minimum; free packages are given out by the trainer
        const recurring = billing !== 'once';
        const session = await stripe('checkout/sessions', 'POST', {
          mode: recurring ? 'subscription' : 'payment',
          customer_email: client.email,
          success_url: `${WEB}me?paid={CHECKOUT_SESSION_ID}`,
          cancel_url: `${WEB}me`,
          line_items: { 0: { quantity: 1, price_data: { currency: item.currency ?? 'usd', unit_amount: price, product_data: { name: name.slice(0, 120) }, ...(recurring ? { recurring: { interval: billing } } : {}) } } },
          metadata: { trainer_id: item.trainer_id, client_id: client.id, package_id: isPkg ? item.id : '', event_id: isEvt ? item.id : '', voucher_id: voucherId ?? '', description: name.slice(0, 200) },
          ...(recurring ? { subscription_data: { metadata: { trainer_id: item.trainer_id, client_id: client.id, package_id: item.id } } } : {}),
        });
        return reply(200, { url: session.url, id: session.id });
      }
      case 'confirm': {
        if (!/^cs_[A-Za-z0-9_]+$/.test(body.session_id ?? '')) return reply(400, { error: 'bad_request' });
        const s = await stripe(`checkout/sessions/${body.session_id}`);
        const { data: c } = await admin.from('coach_clients').select('user_id').eq('id', s.metadata?.client_id ?? '').maybeSingle();
        const t = await trainerFor();
        if (c?.user_id !== uid && t !== s.metadata?.trainer_id) return reply(403, { error: 'not_yours' });
        return reply(200, { status: await record(admin, s) });
      }
      case 'sync': {
        const t = await trainerFor();
        if (!t) return reply(403, { error: 'trainers_only' });
        if (!(await stripeAllowed(admin, t))) return reply(200, { recorded: 0, online: false });
        const list = await stripe('checkout/sessions?limit=100&status=complete');
        let n = 0;
        for (const s of list.data ?? []) if (s.metadata?.trainer_id === t && (await record(admin, s)) === 'recorded') n++;
        return reply(200, { recorded: n, online: true });
      }
      case 'overview': {
        const t = await trainerFor();
        if (!t) return reply(403, { error: 'trainers_only' });
        if (!(await stripeAllowed(admin, t))) return reply(200, { online: false });
        const { data: isAdmin } = await admin.from('dragonfly_admins').select('user_id').eq('user_id', uid).maybeSingle();
        const subs = await stripe('subscriptions?limit=100&status=all');
        const mine = (subs.data ?? []).filter((s: any) => s.metadata?.trainer_id === t).map((s: any) => ({
          id: s.id, status: s.status, client_id: s.metadata?.client_id, package_id: s.metadata?.package_id,
          amount_cents: s.items?.data?.[0]?.price?.unit_amount ?? 0, interval: s.items?.data?.[0]?.price?.recurring?.interval ?? null,
          currency: s.currency, current_period_end: s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? null, cancel_at_period_end: s.cancel_at_period_end,
          created: s.created,
        }));
        // The account's balance and bank payouts are the owner's business only
        if (!isAdmin) return reply(200, { online: true, subscriptions: mine });
        const [bal, payouts] = await Promise.all([stripe('balance'), stripe('payouts?limit=50')]);
        return reply(200, {
          online: true, subscriptions: mine,
          balance: { available: bal.available ?? [], pending: bal.pending ?? [] },
          payouts: (payouts.data ?? []).map((p: any) => ({ id: p.id, amount_cents: p.amount, currency: p.currency, status: p.status, arrival_date: p.arrival_date, created: p.created })),
        });
      }
      case 'cancel_subscription': {
        const t = await trainerFor();
        if (!t || !/^sub_[A-Za-z0-9]+$/.test(body.subscription_id ?? '')) return reply(400, { error: 'bad_request' });
        const s = await stripe(`subscriptions/${body.subscription_id}`);
        if (s.metadata?.trainer_id !== t) return reply(403, { error: 'not_yours' });
        await stripe(`subscriptions/${body.subscription_id}`, 'POST', { cancel_at_period_end: 'true' });
        return reply(200, { ok: true });
      }
      case 'refund': {
        const t = await trainerFor();
        if (!t || !UUID.test(body.payment_id ?? '')) return reply(400, { error: 'bad_request' });
        const { data: p } = await admin.from('coach_payments').select('*').eq('id', body.payment_id).eq('trainer_id', t).maybeSingle();
        if (!p || p.method !== 'stripe' || p.status !== 'paid' || !p.stripe_payment_intent) return reply(409, { error: 'not_refundable' });
        await stripe('refunds', 'POST', { payment_intent: p.stripe_payment_intent });
        // The reason goes on the client's refund notice (records are kept; a refund always says why)
        const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : 'Refunded through Stripe';
        await admin.from('coach_payments').update({ status: 'refunded', status_reason: reason }).eq('id', p.id);
        return reply(200, { ok: true });
      }
      default: return reply(400, { error: 'bad_request' });
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : 'error';
    if (m === 'not_configured') return reply(501, { error: 'not_configured' });
    console.error(e);
    return reply(502, { error: 'stripe_error' });
  }
});
