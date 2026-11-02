import { useCallback, useState } from 'react';
import { addDays, dayKey } from '@/lib/dates';
import { nextDue, signals, type Activity, type Checkin, type CheckinPlan, type Due } from '@/lib/checkins';
import { healthSignals, type Daily } from '@/lib/health';
import type { Client } from '@/lib/model';
import { sb } from '@/lib/supabase';

export type Row = { client: Client; plan: CheckinPlan | null; last: Checkin | null; due: Due; signals: ReturnType<typeof signals> };

/** Everything the Check-ins screens need, for every current client, in a few queries */
export function useCheckins(defaultDays: number) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [recent, setRecent] = useState<(Checkin & { client: Client | undefined })[]>([]);
  const load = useCallback(async () => {
    const from = dayKey(addDays(new Date(), -14)), to = dayKey(addDays(new Date(), 3));
    const [c, pl, ch, a, lg, fd, ms, hd, ac] = await Promise.all([
      sb.from('coach_clients').select('*').in('status', ['active', 'invited']).order('first_name'),
      sb.from('coach_checkin_plans').select('*'),
      sb.from('coach_checkins').select('*').order('done_on', { ascending: false }).order('created_at', { ascending: false }).limit(500),
      sb.from('coach_assignments').select('client_id, scheduled_on, status').gte('scheduled_on', from).lte('scheduled_on', to),
      sb.from('coach_logs').select('client_id, performed_at').gte('performed_at', dayKey(addDays(new Date(), -60))).order('performed_at', { ascending: false }),
      sb.from('coach_food_logs').select('client_id, eaten_on').gte('eaten_on', from).order('eaten_on', { ascending: false }),
      sb.from('coach_measurements').select('client_id, measured_on').order('measured_on', { ascending: false }).limit(1000),
      // Synced from their apps (Health Connect, Oura, WHOOP, Strava…)
      sb.from('coach_health_daily').select('user_id, day, steps, sleep_min, resting_hr').gte('day', dayKey(addDays(new Date(), -28))).limit(5000),
      sb.from('coach_activities').select('user_id, started_at').gte('started_at', addDays(new Date(), -60).toISOString()).order('started_at', { ascending: false }).limit(2000),
    ]);
    const clients = (c.data as Client[]) ?? [];
    const plans = new Map(((pl.data as CheckinPlan[]) ?? []).map((x) => [x.client_id, x]));
    const checks = (ch.data as Checkin[]) ?? [];
    const firstBy = <T extends { client_id: string }>(list: T[] | null, key: keyof T) => {
      const m = new Map<string, string>();
      for (const r of list ?? []) if (!m.has(r.client_id)) m.set(r.client_id, String(r[key]).slice(0, 10));
      return m;
    };
    const lastLog = firstBy(lg.data as { client_id: string; performed_at: string }[], 'performed_at');
    const lastFood = firstBy(fd.data as { client_id: string; eaten_on: string }[], 'eaten_on');
    const lastWeigh = firstBy(ms.data as { client_id: string; measured_on: string }[], 'measured_on');
    const health = new Map<string, Daily[]>();
    for (const d of (hd.data ?? []) as (Daily & { user_id: string })[]) (health.get(d.user_id) ?? health.set(d.user_id, []).get(d.user_id)!).push(d);
    const lastSynced = new Map<string, string>();
    for (const r of (ac.data ?? []) as { user_id: string; started_at: string }[]) if (!lastSynced.has(r.user_id)) lastSynced.set(r.user_id, dayKey(r.started_at));
    const sched = (a.data ?? []) as { client_id: string; scheduled_on: string; status: string }[];
    setRows(clients.map((cl) => {
      const last = checks.find((x) => x.client_id === cl.id) ?? null;
      const synced = cl.user_id ? lastSynced.get(cl.user_id) : undefined, logged = lastLog.get(cl.id);
      const act: Activity = { scheduled: sched.filter((s) => s.client_id === cl.id), lastWorkout: (synced && (!logged || synced > logged) ? synced : logged) ?? null, lastFood: lastFood.get(cl.id) ?? null, lastWeigh: lastWeigh.get(cl.id) ?? null };
      return { client: cl, plan: plans.get(cl.id) ?? null, last, signals: [...signals(act), ...(cl.user_id ? healthSignals(health.get(cl.user_id) ?? []) : [])],
        due: nextDue({ last, started: cl.started_on ?? cl.created_at.slice(0, 10), plan: plans.get(cl.id) ?? null, defaultDays }) };
    }));
    setRecent(checks.slice(0, 60).map((x) => ({ ...x, client: clients.find((cl) => cl.id === x.client_id) })));
  }, [defaultDays]);
  return { rows, recent, load };
}
