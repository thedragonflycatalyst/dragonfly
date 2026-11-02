import type { AndroidSymbol } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Bars } from '@/components/charts';
import { Button, Card, Empty, Icon, Txt } from '@/components/ui';
import { dayKey, fmtShort } from '@/lib/dates';
import { fmtSleep, PROVIDERS, type Daily } from '@/lib/health';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type Act = { id: string; source: keyof typeof PROVIDERS; kind: string; name: string | null; started_at: string; duration_s: number | null; distance_m: number | null; kcal: number | null; avg_hr: number | null; app: string | null };
type Row = Daily & { sources: string[] };

const ICON: [RegExp, AndroidSymbol][] = [[/run|jog/i, 'directions_run'], [/ride|cycl|bik/i, 'directions_bike'], [/swim/i, 'pool'], [/walk|hike/i, 'directions_walk'],
  [/yoga|pilates|stretch/i, 'self_improvement'], [/row/i, 'rowing'], [/weight|strength|lift|gym/i, 'fitness_center']];
const actIcon = (k: string): AndroidSymbol => ICON.find(([re]) => re.test(k))?.[1] ?? 'exercise';
const mins = (s: number | null) => (s == null ? '' : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${Math.round(s / 60)} min`);

/** Steps, sleep, heart rate and workouts from connected apps. `own` shows the link to Connections. */
export function HealthView({ userId, own, name }: { userId: string; own?: boolean; name?: string }) {
  const p = usePalette();
  const [days, setDays] = useState<Row[] | null>(null);
  const [acts, setActs] = useState<Act[]>([]);
  useFocusEffect(useCallback(() => {
    let live = true;
    (async () => {
      const [d, a] = await Promise.all([
        sb.from('coach_health_daily').select('*').eq('user_id', userId).gte('day', dayKey(new Date(Date.now() - 29 * 864e5))).order('day'),
        sb.from('coach_activities').select('*').eq('user_id', userId).gte('started_at', new Date(Date.now() - 60 * 864e5).toISOString()).order('started_at', { ascending: false }).limit(60),
      ]);
      if (!live) return;
      setDays((d.data ?? []) as Row[]); setActs((a.data ?? []) as Act[]);
    })();
    return () => { live = false; };
  }, [userId]));
  if (!days) return <ActivityIndicator color={p.ink} style={{ marginTop: 40 }} />;
  if (!days.length && !acts.length) return (
    <Empty emoji="⌚" title="Nothing synced yet" body={own ? 'Connect Health Connect, Strava, Oura or WHOOP and your steps, sleep and workouts show up here, for you and your trainer.' : `When ${name ?? 'they'} connect${name ? 's' : ''} a watch, ring or health app, their steps, sleep and workouts show up here.`}
      action={own ? <Button title="Connect apps" icon="link" onPress={() => router.push('/connections')} /> : undefined} />
  );
  const last14 = Array.from({ length: 14 }, (_, i) => dayKey(new Date(Date.now() - (13 - i) * 864e5)));
  const by = new Map(days.map((d) => [d.day, d]));
  const label = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
  const latest = (k: keyof Daily) => [...days].reverse().find((d) => d[k] != null)?.[k] as number | undefined;
  const avg7 = (k: keyof Daily) => { const v = last14.slice(7).map((d) => by.get(d)?.[k]).filter((x): x is number => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined; };
  const tiles: { icon: AndroidSymbol; label: string; value: string; sub: string }[] = [];
  const st = avg7('steps'); if (st != null) tiles.push({ icon: 'directions_walk', label: 'Steps', value: Math.round(st).toLocaleString(), sub: 'a day, last 7 days' });
  const sl = avg7('sleep_min'); if (sl != null) tiles.push({ icon: 'bedtime', label: 'Sleep', value: fmtSleep(sl), sub: 'a night, last 7 days' });
  const hr = latest('resting_hr'); if (hr != null) tiles.push({ icon: 'favorite', label: 'Resting heart rate', value: `${hr} bpm`, sub: 'latest' });
  const hv = latest('hrv_ms'); if (hv != null) tiles.push({ icon: 'monitor_heart', label: 'HRV', value: `${Math.round(hv)} ms`, sub: 'latest' });
  const rd = latest('readiness'); if (rd != null) tiles.push({ icon: 'battery_charging_full', label: 'Readiness / recovery', value: `${rd}%`, sub: 'latest' });
  const kc = avg7('active_kcal'); if (kc != null) tiles.push({ icon: 'local_fire_department', label: 'Active calories', value: `${Math.round(kc)}`, sub: 'a day, last 7 days' });
  const sources = [...new Set([...days.flatMap((d) => d.sources), ...acts.map((a) => a.source)])].map((s) => PROVIDERS[s as keyof typeof PROVIDERS] ?? s);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {tiles.map((t) => (
          <Card key={t.label} style={{ flexGrow: 1, flexBasis: 150, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name={t.icon} size={18} color={p.focus} /><Txt v="small">{t.label}</Txt></View>
            <Txt v="h2">{t.value}</Txt>
            <Txt v="small">{t.sub}</Txt>
          </Card>
        ))}
      </View>
      {days.some((d) => d.steps != null) && <Card style={{ gap: 8 }}><Txt v="bold">Steps · last 14 days</Txt><Bars label="Steps, last 14 days" data={last14.map((k) => ({ label: label(k), v: by.get(k)?.steps ?? 0 }))} fmt={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))} /></Card>}
      {days.some((d) => d.sleep_min != null) && <Card style={{ gap: 8 }}><Txt v="bold">Sleep (hours) · last 14 days</Txt><Bars label="Sleep (hours), last 14 days" color={p.focus} data={last14.map((k) => ({ label: label(k), v: (by.get(k)?.sleep_min ?? 0) / 60 }))} fmt={(v) => v.toFixed(1)} /></Card>}
      {acts.length > 0 && <>
        <SectionLabel>Workouts</SectionLabel>
        <Card style={{ padding: 0 }}>
          {acts.map((a, i) => (
            <View key={a.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderBottomWidth: i === acts.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
              <Icon name={actIcon(a.kind)} color={p.focus} />
              <View style={{ flex: 1 }}>
                <Txt v="bold" numberOfLines={1}>{a.name || a.kind}</Txt>
                <Txt v="small">{[fmtShort(a.started_at), mins(a.duration_s), a.distance_m ? `${(a.distance_m / 1000).toFixed(a.distance_m >= 10000 ? 0 : 1)} km` : '', a.kcal ? `${a.kcal} kcal` : '', a.avg_hr ? `${a.avg_hr} bpm` : ''].filter(Boolean).join(' · ')}</Txt>
              </View>
              <Txt v="small">{a.app || PROVIDERS[a.source]}</Txt>
            </View>
          ))}
        </Card>
      </>}
      {sources.length > 0 && <Txt v="small" center>From {sources.join(', ')}</Txt>}
      {own && <Button kind="ghost" icon="link" title="Connected apps" onPress={() => router.push('/connections')} style={{ alignSelf: 'center' }} />}
    </View>
  );
}
