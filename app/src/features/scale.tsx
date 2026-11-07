import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, Text, View } from 'react-native';
import { Segmented, SectionLabel } from '@/components/bits';
import { ChangeBars, Gauge, LineChart, type Series } from '@/components/charts';
import { DateField } from '@/components/date-field';
import { WeightRuler } from '@/components/weight-ruler';
import { Fab, time12, TimeField, Toggle } from '@/components/pickers';
import { connectHealth, healthStatus, openHealthSettings, type HealthStatus } from './health-connect';
import { healthSync, setHealthSync, syncHealth } from './scale-sync';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Txt, useToast } from '@/components/ui';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { dayKey } from '@/lib/dates';
import { progressShareText, scaleProgress } from '@/lib/scale-report';
import { errText } from '@/lib/model';
import {
  bmi, bmiClass, byMonth, changeOver, chartValue, DEFAULT_METRICS, editedMetrics, enterable, extremes, fmtMass, fmtMetric, fmtNum, fromKg, goalEta, GROUPS, isMassChart,
  kcalPerDay, metricLabel, monthlyChange, parseCsv, planCsvImport, PERIODS, RANGES, ratePerWeek, READINGS, signed, spanText, toKgFrom, trend, unitLabel, valueOf, yearlyChange,
  type MetricKey, type ReadingKey, type ScaleSettings, type Weighin,
} from '@/lib/scale';
import { sb } from '@/lib/supabase';
import { cmToFtIn, ftInToCm, num } from '@/lib/units';
import { F, R, usePalette } from '@/lib/theme';

const SERIES_COLORS: Partial<Record<MetricKey, string>> = { weight: '#5aa9e6', lean_mass: '#3fd6c6', muscle_pct: '#2bb3a3', body_fat_pct: '#e0a03a', fat_mass: '#e07a3a', skeletal_muscle_pct: '#7bc96f', bone_mass_kg: '#a98fe0' };
const colorFor = (k: MetricKey, i: number) => SERIES_COLORS[k] ?? ['#5aa9e6', '#e0a03a', '#c77ddb', '#3fd6c6', '#e06a6a'][i % 5];

type Tab = 'chart' | 'history' | 'stats' | 'settings';

/** The Scale: weigh-ins with smart-scale readings, a smoothed trend chart, history, stats and settings.
 *  `userId` is whose scale it is; trainers see a client's scale read-only. */
export function ScaleView({ userId, readOnly, defaults }: { userId: string; readOnly?: boolean; defaults?: { height_cm?: number | null; sex?: ScaleSettings['sex'] } }) {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const unit = app.prefs.bodyweight, fmt = app.prefs.number;
  const [list, setList] = useState<Weighin[] | null>(null);
  const [settings, setSettings] = useState<ScaleSettings | null>(null);
  const [tab, setTab] = useState<Tab>('chart');
  const [chosen, setChosen] = useState<MetricKey[]>(['weight']);
  const [range, setRange] = useState<number | null>(182);
  const [editing, setEditing] = useState<Weighin | 'new' | null>(null);

  const load = useCallback(async () => {
    const [w, s] = await Promise.all([
      sb.from('coach_weighins').select('*').eq('user_id', userId).order('measured_at', { ascending: false }).limit(5000),
      sb.from('coach_scale_settings').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    if (w.error) toast(errText(w.error), false);
    setList(((w.data as Weighin[]) ?? []).map((x) => ({ ...x, weight_kg: Number(x.weight_kg) })));
    setSettings((s.data as ScaleSettings) ?? { user_id: userId, metrics: DEFAULT_METRICS, goal_kg: null, goal_date: null, height_cm: defaults?.height_cm ?? null, sex: defaults?.sex ?? null, reminder_on: false, reminder_time: '07:30' });
  }, [userId, toast, defaults?.height_cm, defaults?.sex]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  // Android: new weigh-ins from the scale's app (through Health Connect) arrive when the Scale opens
  const synced = useRef(false);
  useEffect(() => {
    if (readOnly || !list || synced.current || Platform.OS !== 'android' || !healthSync(userId).on) return;
    synced.current = true;
    syncHealth(userId, list).then((n) => { if (n) { toast(`${n} new weigh-in${n === 1 ? '' : 's'} from Health Connect`); load(); } }).catch(() => {});
  }, [list, readOnly, userId, toast, load]);

  const saveSettings = async (patch: Partial<ScaleSettings>) => {
    const next = { ...settings!, ...patch };
    setSettings(next);
    const { error } = await sb.from('coach_scale_settings').upsert({ ...next, goal_kg: next.goal_kg, updated_at: new Date().toISOString() });
    if (error) toast(errText(error), false);
  };

  if (!list || !settings) return <ActivityIndicator color={p.ink} style={{ marginTop: 40 }} />;
  const metrics = settings.metrics.length ? settings.metrics : DEFAULT_METRICS;
  const height = settings.height_cm ? Number(settings.height_cm) : null;

  return (
    <View style={{ gap: 12, paddingBottom: readOnly ? 0 : 80 }}>
      <Segmented<Tab> value={tab} onChange={setTab} options={[['chart', 'Chart'], ['history', 'History'], ['stats', 'Stats'], ...(readOnly ? [] : [['settings', 'Settings'] as [Tab, string]])]} />
      {list.length === 0 && tab !== 'settings' ? (
        <Empty emoji="⚖️" title={readOnly ? 'No weigh-ins yet' : 'Log your first weigh-in'}
          body={readOnly ? 'When they log weigh-ins in their Scale tab, you’ll see their trend here.' : 'Add your weight and any readings your scale gives (body fat, muscle…). You can also import a CSV from Libra or RENPHO in Settings.'}
          action={readOnly ? undefined : <Button title="Log weigh-in" icon="add" onPress={() => setEditing('new')} />} />
      ) : tab === 'chart' ? (
        <ChartTab list={list} settings={settings} metrics={metrics} chosen={chosen} setChosen={setChosen} range={range} setRange={setRange} unit={unit} fmt={fmt} height={height} />
      ) : tab === 'history' ? (
        <History list={list} metrics={metrics} unit={unit} fmt={fmt} onOpen={readOnly ? undefined : setEditing} />
      ) : tab === 'stats' ? (
        <Stats list={list} unit={unit} fmt={fmt} />
      ) : (
        <SettingsTab settings={settings} save={saveSettings} unit={unit} heightUnit={app.prefs.height} reload={load} count={list.length} list={list} />
      )}
      {!readOnly && tab !== 'settings' && <Fab title="Log weigh-in" onPress={() => setEditing('new')} />}
      {!readOnly && <LogSheet entry={editing} onClose={() => setEditing(null)} metrics={metrics} unit={unit} onSaved={() => { setEditing(null); load(); }} last={list[0]} />}
    </View>
  );
}

/* ---------------- chart ---------------- */
function ChartTab({ list, settings, metrics, chosen, setChosen, range, setRange, unit, fmt, height }: {
  list: Weighin[]; settings: ScaleSettings; metrics: MetricKey[]; chosen: MetricKey[]; setChosen: (m: MetricKey[]) => void;
  range: number | null; setRange: (r: number | null) => void; unit: ReturnType<typeof useApp>['prefs']['bodyweight']; fmt: 'dot' | 'comma'; height: number | null;
}) {
  const p = usePalette();
  const toast = useToast();
  const report = useMemo(() => scaleProgress(list, range, settings.goal_kg == null ? null : Number(settings.goal_kg)), [list, range, settings.goal_kg]);
  const shareProgress = async () => {
    if (!report) return;
    const message = progressShareText(report, unit, fmt);
    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(message);
        toast('Progress summary copied. Paste it wherever you want to share.');
      } else {
        await Share.share({ message, title: 'Dragonfly Coach · Weight progress' });
      }
    } catch (error) { toast(errText(error), false); }
  };
  const tr = useMemo(() => trend(list), [list]);
  const last = tr[tr.length - 1];
  const rate = ratePerWeek(tr);
  const goal = settings.goal_kg != null ? Number(settings.goal_kg) : null;
  const eta = goal != null && last ? goalEta(last.trend, goal, rate) : null;
  const chartable = metrics.filter((k) => list.some((w) => chartValue(w, k, height) != null));
  const sel = chosen.filter((k) => chartable.includes(k)).length ? chosen.filter((k) => chartable.includes(k)) : ['weight' as MetricKey];
  const massMode = sel.every(isMassChart);
  const toggle = (k: MetricKey) => {
    if (!isMassChart(k)) return setChosen([k]);
    const base = sel.filter(isMassChart);
    setChosen(base.includes(k) ? (base.length > 1 ? base.filter((x) => x !== k) : base) : [...base, k]);
  };
  const now = Date.now();
  const first = tr[0]?.t ?? now;
  const to = Math.max(now, last?.t ?? now) + (range ?? (now - first) / 86_400_000) * 0.12 * 86_400_000;
  const from = range ? now - range * 86_400_000 : first - 86_400_000;
  const series: Series[] = sel.map((k, i) => {
    const pts = list.map((w) => ({ w, v: chartValue(w, k, height) })).filter((x) => x.v != null) as { w: Weighin; v: number }[];
    const sm = trend(pts.map((x) => ({ measured_at: x.w.measured_at, weight_kg: x.v })));
    const conv = (v: number) => (massMode ? fromKg(v, unit) : v);
    const latest = pts.sort((a, b) => b.w.measured_at.localeCompare(a.w.measured_at))[0];
    const shown = k === 'body_fat_pct' || k === 'muscle_pct' || k === 'skeletal_muscle_pct' ? valueOf(latest.w, k)! : latest.v;
    return {
      key: k, label: metricLabel(k), color: colorFor(k, i),
      points: sm.map((q) => ({ t: q.t, v: conv(q.trend) })),
      raw: k === 'weight' ? sm.map((q) => ({ t: q.t, v: conv(q.kg) })) : undefined,
      end: k === 'lean_mass' && latest.w.metrics.body_fat_pct != null ? `${fmtNum(100 - latest.w.metrics.body_fat_pct, 1, fmt)} %` : fmtMetric(k, shown, unit, fmt),
    };
  });
  const goalShown = massMode && sel.includes('weight') && goal != null ? fromKg(goal, unit) : null;
  const projection = massMode && sel.includes('weight') && last && rate != null
    ? { a: { t: last.t, v: fromKg(last.trend, unit) }, b: { t: last.t + 365 * 86_400_000, v: fromKg(last.trend + (rate / 7) * 365, unit) } } : null;
  const b = height && last ? bmi(last.trend, height) : null;
  return (
    <>
      <Card style={{ paddingHorizontal: 6, paddingVertical: 10 }}>
        <LineChart series={series} from={from} to={to} goal={goalShown} projection={projection} height={320}
          fmtY={(v) => fmtNum(v, Math.abs(v) < 20 ? 1 : 0, fmt)}
          fmtPoint={(v) => `${fmtNum(v, 1, fmt)}${massMode ? ` ${unitLabel(unit)}` : ""}`}
          label={`${sel.map(metricLabel).join(', ')} over time`} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 }}>
          {RANGES.map(([l, d]) => <Chip key={l} label={l} selected={range === d} onPress={() => setRange(d)} />)}
        </View>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chartable.map((k) => <Chip key={k} label={metricLabel(k)} selected={sel.includes(k)} color={colorFor(k, 0)} onPress={() => toggle(k)} />)}
      </View>
      {report && (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <Txt v="bold">Progress summary</Txt>
            <Txt v="small">{report.count} weigh-in{report.count === 1 ? '' : 's'} in period</Txt>
          </View>
          <Txt v="small">{new Date(report.start).toLocaleDateString()} – {new Date(report.end).toLocaleDateString()}</Txt>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <View><Txt v="small">First</Txt><Txt v="bold">{fmtMass(report.startKg, unit, fmt)}</Txt></View>
            <View><Txt v="small">Latest</Txt><Txt v="bold">{fmtMass(report.endKg, unit, fmt)}</Txt></View>
            <View><Txt v="small">Change</Txt><Txt v="bold">{report.count < 2 ? '—' : `${signed(fromKg(report.changeKg, unit), 1, fmt)} ${unitLabel(unit)}`}</Txt></View>
          </View>
          <Txt v="small">Only recorded weigh-ins are included. The summary contains weight measurements and optional goal information; review before sharing.</Txt>
          <Button kind="ghost" icon="share" title={Platform.OS === 'web' ? 'Copy progress summary' : 'Share progress summary'} onPress={shareProgress} style={{ alignSelf: 'flex-start' }} />
        </Card>
      )}
      {last && (
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ gap: 2, minWidth: 130 }}>
            <Txt v="bold">Trend: {fmtMass(last.trend, unit, fmt)}</Txt>
            <Txt>{rate == null ? 'Rate: needs a few days' : `${signed(fromKg(rate, unit), 1, fmt)} ${unitLabel(unit)}/week`}</Txt>
            {rate != null && <Txt v="small">{Math.abs(kcalPerDay(rate)) < 25 ? 'About even on calories' : `≈ ${fmtNum(Math.abs(kcalPerDay(rate)), 0, fmt)} kcal/day ${rate < 0 ? 'deficit' : 'surplus'}`}</Txt>}
          </View>
          {b != null ? <Gauge value={b} min={15} max={40} caption={bmiClass(b)} bands={[{ to: 18.5, color: '#7fb3e6' }, { to: 25, color: p.good }, { to: 30, color: p.gold }, { to: 35, color: '#e0803a' }, { to: 40, color: p.danger }]} />
            : <Txt v="small" style={{ maxWidth: 150 }}>Add your height in Settings to see BMI.</Txt>}
          <View style={{ gap: 2, alignItems: 'flex-end', minWidth: 130 }}>
            {goal != null ? <>
              <Txt v="bold">Goal: {fmtMass(goal, unit, fmt)}</Txt>
              <Txt>Δ {signed(fromKg(goal - last.trend, unit), 1, fmt)} {unitLabel(unit)}</Txt>
              <Txt v="small">{eta ? (Math.abs(goal - last.trend) < 0.05 ? 'Reached 🎉' : `Around ${eta.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`) : 'Not at this rate'}</Txt>
            </> : <Txt v="small" style={{ textAlign: 'right' }}>Set a goal weight in Settings to see when you’ll get there.</Txt>}
          </View>
        </Card>
      )}
    </>
  );
}

/* ---------------- history ---------------- */
function History({ list, metrics, unit, fmt, onOpen }: { list: Weighin[]; metrics: MetricKey[]; unit: ReturnType<typeof useApp>['prefs']['bodyweight']; fmt: 'dot' | 'comma'; onOpen?: (w: Weighin) => void }) {
  const p = usePalette();
  const groups = useMemo(() => byMonth(list), [list]);
  const [shown, setShown] = useState(6);
  const tags = enterable(metrics);
  return (
    <>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {groups.slice(0, shown).map((g) => (
          <View key={g.month}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: p.soft }}>
              <Txt v="bold">{new Date(`${g.month}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Txt>
              <Txt v="smallBold">{signed(fromKg(g.change ?? 0, unit), 1, fmt)} {unitLabel(unit)} ({fmtNum(Math.abs(g.pct ?? 0), 1, fmt)}%)</Txt>
            </View>
            {g.items.map((w) => {
              const d = new Date(w.measured_at);
              return (
                <Pressable key={w.id} disabled={!onOpen} onPress={() => onOpen?.(w)} accessibilityRole={onOpen ? 'button' : undefined}
                  accessibilityLabel={`${d.toDateString()}, ${fmtMass(w.weight_kg, unit, fmt)}`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: p.line, opacity: pressed ? 0.7 : 1 })}>
                  <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: p.soft, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt v="bold" style={{ lineHeight: 19 }}>{d.getDate()}</Txt>
                    <Txt v="small" style={{ fontSize: 11, lineHeight: 13 }}>{d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Txt>
                  </View>
                  <Text style={{ fontSize: 30, color: p.focus, fontFamily: F.display }}>{fmtNum(fromKg(w.weight_kg, unit), 1, fmt)}<Text style={{ fontSize: 14, color: p.muted }}> {unitLabel(unit)}</Text></Text>
                  <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
                    <Txt v="small">{d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{w.source !== 'manual' ? ` · ${w.source === 'import' ? 'imported' : 'Health Connect'}` : ''}</Txt>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                      {tags.filter((k) => w.metrics[k] != null).slice(0, 4).map((k) => (
                        <View key={k} style={{ backgroundColor: k === 'body_fat_pct' ? p.gold : p.focus, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 12, color: p.onAccent, fontFamily: F.bodyBold }}>{READINGS[k].short} {fmtMetric(k, w.metrics[k]!, unit, fmt).replace(' %', '%')}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>
      {groups.length > shown && <Button kind="ghost" title="Show earlier months" onPress={() => setShown((s) => s + 12)} />}
      <Txt v="small" center>{list.length} entr{list.length === 1 ? 'y' : 'ies'}{list.length > 1 ? ` · ${spanText(list)}` : ''}</Txt>
    </>
  );
}

/* ---------------- stats ---------------- */
function Stats({ list, unit, fmt }: { list: Weighin[]; unit: ReturnType<typeof useApp>['prefs']['bodyweight']; fmt: 'dot' | 'comma' }) {
  const p = usePalette();
  const tr = useMemo(() => trend(list), [list]);
  const ex = extremes(list)!;
  const [pct, setPct] = useState(false);
  const months = monthlyChange(tr);
  const years = [...new Set(months.map((m) => m.month.slice(0, 4)))];
  const [year, setYear] = useState(years[years.length - 1] ?? String(new Date().getFullYear()));
  const yearly = yearlyChange(tr);
  const show = (kg: number, pc: number) => (pct ? `${signed(pc, 1, fmt)}%` : `${signed(fromKg(kg, unit), 1, fmt)} ${unitLabel(unit)}`);
  const Big = ({ title, w }: { title: string; w: Weighin }) => (
    <Card style={{ flex: 1, minWidth: 150, alignItems: 'center', gap: 2 }}>
      <Txt v="smallBold" color={p.focus}>{title}</Txt>
      <Txt v="h2">{fmtMass(w.weight_kg, unit, fmt)}</Txt>
      <Txt v="small">{new Date(w.measured_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Txt>
    </Card>
  );
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Big title="Lowest weight" w={ex.lowest} /><Big title="Highest weight" w={ex.highest} /></View>
      <Segmented<'u' | 'p'> value={pct ? 'p' : 'u'} onChange={(v) => setPct(v === 'p')} options={[['u', unitLabel(unit)], ['p', '%']]} />
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row' }}><Txt v="smallBold" style={{ flex: 1.3 }}> </Txt><Txt v="smallBold" style={{ flex: 1, textAlign: 'right' }}>Change</Txt><Txt v="smallBold" style={{ flex: 1, textAlign: 'right' }}>Per week</Txt></View>
        {PERIODS.map(([label, days]) => {
          const c = changeOver(tr, days);
          return (
            <View key={label} style={{ flexDirection: 'row' }}>
              <Txt style={{ flex: 1.3 }}>{label}</Txt>
              <Txt style={{ flex: 1, textAlign: 'right' }}>{c ? show(c.kg, c.pct) : '–'}</Txt>
              <Txt style={{ flex: 1, textAlign: 'right' }}>{c ? show(c.perWeek, (c.pct / days) * 7) : '–'}</Txt>
            </View>
          );
        })}
        <Txt v="small" style={{ marginTop: 4 }}>Based on your trend, so one heavy morning doesn’t skew it.</Txt>
      </Card>
      {months.length > 0 && <>
        <SectionLabel>By month</SectionLabel>
        {years.length > 1 && <Segmented value={year} onChange={setYear} options={years.slice(-4).map((y) => [y, y] as [string, string])} />}
        <Card>
          <ChangeBars label={`Monthly change in ${year}`} data={months.filter((m) => m.month.startsWith(year)).map((m) => ({ label: new Date(`${m.month}-15T12:00:00`).toLocaleDateString(undefined, { month: 'short' }), v: pct ? m.pct : fromKg(m.kg, unit) }))}
            fmt={(v) => fmtNum(v, 1, fmt)} />
        </Card>
      </>}
      {yearly.length > 0 && <>
        <SectionLabel>By year</SectionLabel>
        <Card><ChangeBars label="Yearly change" data={yearly.map((y) => ({ label: String(y.year), v: pct ? y.pct : fromKg(y.kg, unit) }))} fmt={(v) => fmtNum(v, 1, fmt)} /></Card>
      </>}
    </>
  );
}

/* ---------------- settings ---------------- */
function SettingsTab({ settings, save, unit, heightUnit, reload, count, list }: {
  settings: ScaleSettings; save: (p: Partial<ScaleSettings>) => Promise<void>; unit: ReturnType<typeof useApp>['prefs']['bodyweight'];
  heightUnit: 'ft' | 'cm'; reload: () => void; count: number; list: Weighin[];
}) {
  const p = usePalette();
  const toast = useToast();
  const h = settings.height_cm ? Number(settings.height_cm) : null;
  const [ft, setFt] = useState(h ? String(cmToFtIn(h).ft) : '');
  const [inch, setIn] = useState(h ? String(cmToFtIn(h).in) : '');
  const [cm, setCm] = useState(h ? String(Math.round(h)) : '');
  const [goal, setGoal] = useState(settings.goal_kg != null ? String(Math.round(fromKg(Number(settings.goal_kg), unit) * 10) / 10) : '');
  const [importing, setImporting] = useState(false);
  const metrics = settings.metrics.length ? settings.metrics : DEFAULT_METRICS;
  const flip = (k: MetricKey) => {
    if (k === 'weight') return;
    save({ metrics: metrics.includes(k) ? metrics.filter((x) => x !== k) : [...metrics, k] });
  };
  const saveBody = () => {
    const height = heightUnit === 'cm' ? num(cm) : (num(ft) != null ? ftInToCm(num(ft)!, num(inch) ?? 0) : null);
    const g = num(goal);
    if (height != null && (height < 80 || height > 260)) return toast('That height doesn’t look right', false);
    const gk = g != null ? Math.round(toKgFrom(g, unit) * 100) / 100 : null;
    if (gk != null && (gk < 20 || gk > 400)) return toast('That goal doesn’t look right', false);
    save({ height_cm: height != null ? Math.round(height * 10) / 10 : null, goal_kg: gk }).then(() => toast('Saved'));
  };
  const doImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets[0]) return;
      setImporting(true);
      const text = Platform.OS === 'web' ? await (await fetch(res.assets[0].uri)).text() : await new (await import('expo-file-system')).File(res.assets[0].uri).text();
      const { rows, skipped } = parseCsv(text, unit);
      if (!rows.length) return toast('No weigh-ins found. Export a CSV from Libra (Settings → Export) or the RENPHO app and try again.', false);
      // Fetch all timestamp collisions from the database, not just the first 5000
      // records currently loaded into the Scale view.
      const dates = [...new Set(rows.map((r) => r.measured_at))];
      const existing: Pick<Weighin, 'id' | 'measured_at' | 'weight_kg' | 'metrics'>[] = [];
      for (let i = 0; i < dates.length; i += 100) {
        const { data, error } = await sb.from('coach_weighins')
          .select('id,measured_at,weight_kg,metrics').eq('user_id', settings.user_id)
          .in('measured_at', dates.slice(i, i + 100));
        if (error) throw error;
        existing.push(...((data ?? []) as typeof existing));
      }
      const plan = planCsvImport(rows, existing);
      const changes = plan.inserts.length + plan.enrichments.length;
      if (!changes) {
        toast(`Already up to date: ${plan.unchanged} existing weigh-ins. No changes made.`);
        return;
      }
      const preview = [
        `${plan.inserts.length} new weigh-ins`,
        `${plan.enrichments.length} existing weigh-ins will gain missing measurements`,
        `${plan.unchanged} unchanged`,
        ...(plan.conflictingWeights ? [`${plan.conflictingWeights} different weights at matching timestamps will be kept as already recorded`] : []),
        ...(plan.duplicateRows ? [`${plan.duplicateRows} repeated file rows combined`] : []),
        ...(skipped ? [`${skipped} unreadable rows skipped`] : []),
        'Existing weights, manually entered measurements and notes will never be replaced.',
      ].join('\n');
      if (!(await confirm('Review CSV import', preview, 'Import safely'))) return;
      for (let i = 0; i < plan.inserts.length; i += 200) {
        const { error } = await sb.from('coach_weighins').upsert(
          plan.inserts.slice(i, i + 200).map((r) => ({ ...r, user_id: settings.user_id, source: 'import' })),
          { onConflict: 'user_id,measured_at', ignoreDuplicates: true });
        if (error) throw error;
      }
      for (const entry of plan.enrichments) {
        const { error } = await sb.from('coach_weighins')
          .update({ metrics: entry.metrics }).eq('user_id', settings.user_id).eq('id', entry.id);
        if (error) throw error;
      }
      const seen = new Set(rows.flatMap((r) => Object.keys(r.metrics))) as Set<ReadingKey>;
      const add = [...seen].filter((k) => !metrics.includes(k));
      if (add.length) await save({ metrics: [...metrics, ...add] });
      toast(`Imported ${plan.inserts.length} new; enriched ${plan.enrichments.length}`); reload();
    } catch (e) { toast(errText(e), false); } finally { setImporting(false); }
  };
  const exportCsv = () => {
    const keys = (Object.keys(READINGS) as ReadingKey[]).filter((k) => list.some((w) => w.metrics?.[k] != null));
    const lines = [['date', `weight (${unitLabel(unit)})`, ...keys.map((k) => READINGS[k].label + (READINGS[k].unit === 'mass' ? ` (${unitLabel(unit)})` : READINGS[k].unit ? ` (${READINGS[k].unit})` : ''))].join(',')];
    for (const w of [...list].reverse()) lines.push([w.measured_at, fromKg(w.weight_kg, unit).toFixed(1), ...keys.map((k) => (w.metrics[k] == null ? '' : READINGS[k].unit === 'mass' ? fromKg(w.metrics[k]!, unit).toFixed(1) : String(w.metrics[k])))].join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = `dragonfly-scale-${dayKey(new Date())}.csv`; a.click();
  };
  const reminder = async (on: boolean, time = settings.reminder_time.slice(0, 5)) => {
    await save({ reminder_on: on, reminder_time: time });
    if (Platform.OS === 'web') return on ? toast('Reminders come through the Dragonfly app on your phone') : undefined;
    try {
      const N = await import('expo-notifications');
      const all = await N.getAllScheduledNotificationsAsync();
      await Promise.all(all.filter((n) => n.content.data?.kind === 'weigh-in').map((n) => N.cancelScheduledNotificationAsync(n.identifier)));
      if (!on) return;
      const perm = await N.requestPermissionsAsync();
      if (!perm.granted) return toast('Allow notifications for Dragonfly in your phone’s settings', false);
      const [hh, mm] = time.split(':').map(Number);
      await N.scheduleNotificationAsync({ content: { title: 'Time to weigh in', body: 'Step on the scale and log it in Dragonfly.', data: { kind: 'weigh-in' } }, trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour: hh, minute: mm } });
      toast(`Daily reminder at ${time12(time)}`);
    } catch (e) { toast(errText(e), false); }
  };
  return (
    <>
      <SectionLabel>You</SectionLabel>
      <Card>
        {heightUnit === 'cm' ? <Field label="Height (cm)" value={cm} onChangeText={setCm} keyboardType="decimal-pad" />
          : <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Height (ft)" value={ft} onChangeText={setFt} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="(in)" value={inch} onChangeText={setIn} keyboardType="number-pad" /></View>
          </View>}
        <Txt v="bold" style={{ marginBottom: 8 }}>Sex</Txt>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {(['male', 'female', 'other'] as const).map((s) => <Chip key={s} label={s[0].toUpperCase() + s.slice(1)} selected={settings.sex === s} onPress={() => save({ sex: s })} />)}
        </View>
        <Field label={`Goal weight (${unitLabel(unit)})`} hint="(optional)" value={goal} onChangeText={setGoal} keyboardType="decimal-pad" />
        <DateField label="Goal date" optional value={settings.goal_date} onChange={(d) => save({ goal_date: d })} min={dayKey(new Date())} />
        <Button title="Save" onPress={saveBody} style={{ alignSelf: 'flex-start' }} />
      </Card>

      <SectionLabel>What to track</SectionLabel>
      <Card style={{ gap: 4 }}>
        <Txt v="small" style={{ marginBottom: 6 }}>Tick the readings your scale gives. They show up when you log a weigh-in and on the chart. Weight is always on.</Txt>
        {GROUPS.map((g) => (
          <View key={g.title} style={{ marginBottom: 8 }}>
            <Txt v="smallBold" color={p.muted} style={{ marginBottom: 6 }}>{g.title}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {g.keys.map((k) => <Chip key={k} label={metricLabel(k)} selected={metrics.includes(k)} onPress={() => flip(k)} />)}
            </View>
          </View>
        ))}
        <Txt v="small">Lean mass and fat mass are worked out from body fat; BMI from your height.</Txt>
      </Card>

      <SectionLabel>Reminder</SectionLabel>
      <Card>
        <Toggle label="Daily weigh-in reminder" sub="Same time each day works best" value={settings.reminder_on} onChange={(v) => reminder(v)} />
        {settings.reminder_on && <TimeField label="Time" value={settings.reminder_time.slice(0, 5)} onChange={(t) => reminder(true, t)} />}
      </Card>

      <SectionLabel>Your data</SectionLabel>
      <Card style={{ gap: 10 }}>
        <Txt v="small">Bring your history over from Libra (Settings → Export data) or RENPHO (Me → Data → Export). {count} weigh-ins so far.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button kind="ghost" icon="download" title="Import CSV" busy={importing} onPress={doImport} />
          {Platform.OS === 'web' && count > 0 && <Button kind="ghost" icon="share" title="Export CSV" onPress={exportCsv} />}
        </View>
      </Card>

      <SectionLabel>Sync with your scale</SectionLabel>
      <HealthCard userId={settings.user_id} list={list} reload={reload} />
    </>
  );
}

/* ---------------- Health Connect ---------------- */
function HealthCard({ userId, list, reload }: { userId: string; list: Weighin[]; reload: () => void }) {
  const toast = useToast();
  const p = usePalette();
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [on, setOn] = useState(() => healthSync(userId).on);
  const [busy, setBusy] = useState<'connect' | 'history' | null>(null);
  useEffect(() => { healthStatus().then(setStatus); }, []);
  const last = healthSync(userId).last;
  const run = async (kind: 'connect' | 'history') => {
    setBusy(kind);
    try {
      if (kind === 'connect' && !(await connectHealth())) return toast('Allow Dragonfly to read your weight in Health Connect to sync', false);
      const n = await syncHealth(userId, list, kind === 'history' ? new Date(Date.now() - 10 * 365 * 86_400_000) : undefined);
      setOn(true); reload();
      if (n) toast(`Added ${n} weigh-in${n === 1 ? '' : 's'}`);
      else toast(list.length ? 'All caught up' : 'No weigh-ins in Health Connect yet. In the RENPHO app, turn on sharing Weight to Health Connect, weigh in, then Sync now.', !!list.length);
    } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };
  if (status === null) return null;
  if (status === 'unsupported') return (
    <Card><Txt v="small">Automatic sync uses Health Connect, so it works in the Dragonfly app on Android. Turn it on there and weigh-ins from your RENPHO, Libra, Samsung Health, Fitbit or Withings show up here too.</Txt></Card>
  );
  if (status !== 'ready') return (
    <Card style={{ gap: 10 }}>
      <Txt>{status === 'update_needed' ? 'Health Connect needs an update before Dragonfly can use it.' : 'Install Health Connect (free from Google) to sync weigh-ins from your scale’s app.'}</Txt>
      <Button kind="ghost" icon="open_in_new" title="Open Health Connect" onPress={openHealthSettings} style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
  return (
    <Card style={{ gap: 10 }}>
      <Txt v="small">Your RENPHO app (or Libra, Samsung Health, Fitbit, Withings…) shares each weigh-in with Health Connect, and Dragonfly picks it up whenever you open the Scale: weight, body fat, bone mass, body water and BMR. In the RENPHO app, switch on sharing to Health Connect (in its settings, under connected apps or integrations).</Txt>
      {on ? <>
        {list.length === 0 && <Txt v="small" color={p.gold}>Nothing has come in yet. Open the RENPHO app → Me → Health Connect (or Settings → Connected apps), allow it to write Weight, Body fat and the rest, then tap Sync now.</Txt>}
        <Txt v="bold">✓ Syncing{last ? ` · last checked ${new Date(last).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button kind="ghost" icon="sync" title="Sync now" busy={busy === 'connect'} onPress={() => run('connect')} />
          <Button kind="ghost" icon="download" title="Bring in all history" busy={busy === 'history'} onPress={() => run('history')} />
          <Button kind="quiet" title="Turn off" onPress={() => { setHealthSync(userId, { on: false, last }); setOn(false); }} />
        </View>
        <Txt v="small">Muscle mass, visceral fat, metabolic age and the arm/leg/trunk readings aren’t shared through Health Connect; add those with a RENPHO CSV export now and then.</Txt>
      </> : <Button title="Connect Health Connect" icon="monitor_weight" busy={busy === 'connect'} onPress={() => run('connect')} style={{ alignSelf: 'flex-start' }} />}
    </Card>
  );
}

/* ---------------- log / edit ---------------- */
function LogSheet({ entry, onClose, metrics, unit, onSaved, last }: {
  entry: Weighin | 'new' | null; onClose: () => void; metrics: MetricKey[]; unit: ReturnType<typeof useApp>['prefs']['bodyweight']; onSaved: () => void; last?: Weighin;
}) {
  const toast = useToast();
  const p = usePalette();
  const app = useApp();
  const editing = entry && entry !== 'new' ? entry : null;
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [weight, setWeight] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Weighin | 'new' | null>(null);
  if (entry !== open) {
    setOpen(entry);
    const d = editing ? new Date(editing.measured_at) : new Date();
    setDay(dayKey(d)); setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setWeight(editing ? String(Math.round(fromKg(editing.weight_kg, unit) * 10) / 10) : '');
    const v: Record<string, string> = {};
    for (const k of enterable(metrics)) { const x = editing?.metrics[k]; if (x != null) v[k] = String(READINGS[k].unit === 'mass' ? Math.round(fromKg(x, unit) * 10) / 10 : x); }
    setVals(v); setNote(editing?.note ?? '');
  }
  const save = async () => {
    const w = num(weight);
    if (w == null) return toast('Enter your weight', false);
    const kg = Math.round(toKgFrom(w, unit) * 100) / 100;
    if (kg < 20 || kg > 400) return toast('That weight doesn’t look right', false);
    const edits: Partial<Record<ReadingKey, number | null>> = {};
    const visible = enterable(metrics);
    for (const k of visible) {
      const x = num(vals[k]); if (x == null) { edits[k] = null; continue; }
      const v = READINGS[k].unit === 'mass' ? Math.round(toKgFrom(x, unit) * 100) / 100 : x;
      if (v < 0 || v > READINGS[k].max * (READINGS[k].unit === 'mass' ? 2.3 : 1)) return toast(`${READINGS[k].label} doesn’t look right`, false);
      edits[k] = v;
    }
    const m = editedMetrics(editing?.metrics, visible, edits);
    const when = new Date(`${day}T${time || '12:00'}:00`);
    if (Number.isNaN(when.getTime()) || when.getTime() > Date.now() + 3_600_000) return toast('Check the date and time', false);
    setBusy(true);
    const row = { measured_at: when.toISOString(), weight_kg: kg, metrics: m, note: note.trim() || null };
    const { error } = editing ? await sb.from('coach_weighins').update(row).eq('id', editing.id) : await sb.from('coach_weighins').insert({ ...row, source: 'manual' });
    setBusy(false);
    if (error) return toast(/duplicate/.test(error.message) ? 'You already have a weigh-in at that exact time' : errText(error), false);
    toast(editing ? 'Updated' : 'Logged'); onSaved();
  };
  const remove = async () => {
    if (!editing || !(await confirm('Delete this weigh-in?', undefined, 'Delete', true))) return;
    const { error } = await sb.from('coach_weighins').delete().eq('id', editing.id);
    if (error) return toast(errText(error), false);
    onSaved();
  };
  const fields = enterable(metrics);
  return (
    <Sheet visible={!!entry} onClose={onClose} title={editing ? 'Edit weigh-in' : 'Log weigh-in'}>
      <WeightRuler value={weight} fallbackKg={editing?.weight_kg ?? last?.weight_kg} unit={unit} format={app.prefs.number} onChange={setWeight} />
      <Field label={`Weight (${unitLabel(unit)})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad"
        placeholder={last ? String(Math.round(fromKg(last.weight_kg, unit) * 10) / 10) : ''} />
      {fields.length > 0 && <>
        <Txt v="smallBold" color={p.muted} style={{ marginBottom: 8 }}>From your scale (optional)</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 }}>
          {fields.map((k) => (
            <View key={k} style={{ flexGrow: 1, flexBasis: 140 }}>
              <Field label={`${READINGS[k].label}${READINGS[k].unit === 'mass' ? ` (${unitLabel(unit)})` : READINGS[k].unit ? ` (${READINGS[k].unit})` : ''}`}
                value={vals[k] ?? ''} onChangeText={(x) => setVals((v) => ({ ...v, [k]: x }))} keyboardType="decimal-pad" />
            </View>
          ))}
        </View>
      </>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1.4 }}><DateField label="Date" value={day} onChange={setDay} max={dayKey(new Date())} /></View>
        <View style={{ flex: 1 }}><TimeField label="Time" value={time} onChange={setTime} /></View>
      </View>
      <Field label="Note" hint="(optional)" value={note} onChangeText={setNote} placeholder="After a long run" />
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
        <Button title={editing ? 'Save' : 'Log it'} icon="check" busy={busy} onPress={save} />
        {editing && <Button kind="danger" icon="delete" title="Delete" onPress={remove} />}
      </View>
      {fields.length === 0 && <Pressable onPress={onClose} style={{ marginTop: 12, borderRadius: R.sm }}><Txt v="small">Track body fat, muscle and more: tick them in Settings.</Txt></Pressable>}
    </Sheet>
  );
}

