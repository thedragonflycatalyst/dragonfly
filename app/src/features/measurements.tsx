import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Pair } from '@/components/bits';
import { DateField } from '@/components/date-field';
import { Button, Card, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { ask } from '@/lib/ask';
import { dayKey, fromKey } from '@/lib/dates';
import { BODY_PARTS, errText, type Measurement } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { fmtLength, fmtWeight, lengthUnit, showWeight, toCm, toKg, weightUnit, num } from '@/lib/units';
import { usePalette } from '@/lib/theme';
import type { SectionProps } from './common';

/** Weigh-ins, body fat and tape measurements. Both trainer and client can add entries. */
export function Measurements({ client, role, units, me }: SectionProps) {
  const p = usePalette();
  const toast = useToast();
  const [rows, setRows] = useState<Measurement[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [day, setDay] = useState<string | null>(dayKey(new Date()));
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from('coach_measurements').select('*').eq('client_id', client.id).order('measured_on', { ascending: false }).order('created_at', { ascending: false });
    setRows((data as Measurement[]) ?? []);
  }, [client.id]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const row: Record<string, unknown> = { client_id: client.id, trainer_id: client.trainer_id, measured_on: day ?? dayKey(new Date()), note: f.note?.trim() || null };
    if (f.weight) { const v = toKg(f.weight, units); if (v === null) return toast('Check the weight', false); row.weight_kg = v; }
    if (f.body_fat) { const v = num(f.body_fat); if (v === null) return toast('Check the body fat', false); row.body_fat_pct = v; }
    for (const [k, label] of BODY_PARTS) if (f[k]) { const v = toCm(f[k], units); if (v === null) return toast(`Check the ${label.toLowerCase()} number`, false); row[k] = v; }
    if (!['weight_kg', 'body_fat_pct', ...BODY_PARTS.map((b) => b[0])].some((k) => row[k] != null)) return toast('Enter at least one measurement', false);
    setBusy(true);
    const { error } = await sb.from('coach_measurements').insert(row);
    setBusy(false);
    if (error) return toast(errText(error), false);
    setF({}); setAdding(false); toast('Saved'); load();
  };

  const weights = (rows ?? []).filter((r) => r.weight_kg != null);
  const latest = weights[0], firstW = weights[weights.length - 1];
  const change = latest && firstW && latest !== firstW ? showWeight(Number(latest.weight_kg), units) - showWeight(Number(firstW.weight_kg), units) : null;

  return (
    <View style={{ gap: 14 }}>
      {weights.length > 0 && (
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
          <View><Txt v="small">Latest weight</Txt><Txt v="h2">{fmtWeight(latest.weight_kg, units)}</Txt></View>
          {change !== null && <View><Txt v="small">Since {fromKey(firstW.measured_on).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Txt>
            <Txt v="h2" color={p.focus}>{change > 0 ? '+' : ''}{Math.round(change * 10) / 10} {weightUnit(units)}</Txt></View>}
        </Card>
      )}

      {adding ? (
        <Card>
          <Txt v="h3" style={{ marginBottom: 12 }}>New entry</Txt>
          <DateField label="Date" value={day} onChange={setDay} max={dayKey(new Date())} />
          <Pair>
            <Field label={`Weight (${weightUnit(units)})`} value={f.weight ?? ''} onChangeText={(v) => setF({ ...f, weight: v })} keyboardType="decimal-pad" />
            <Field label="Body fat (%)" value={f.body_fat ?? ''} onChangeText={(v) => setF({ ...f, body_fat: v })} keyboardType="decimal-pad" />
          </Pair>
          <Txt v="smallBold" style={{ marginBottom: 8 }}>Measurements ({lengthUnit(units)})</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 }}>
            {BODY_PARTS.map(([k, label]) => (
              <View key={k} style={{ flexBasis: 120, flexGrow: 1 }}><Field label={label} value={f[k] ?? ''} onChangeText={(v) => setF({ ...f, [k]: v })} keyboardType="decimal-pad" /></View>
            ))}
          </View>
          <Field label="Note" hint="(optional)" value={f.note ?? ''} onChangeText={(v) => setF({ ...f, note: v })} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Save" busy={busy} onPress={save} />
            <Button kind="ghost" title="Cancel" onPress={() => { setAdding(false); setF({}); }} />
          </View>
        </Card>
      ) : <Button title={role === 'client' ? 'Log a weigh-in or measurement' : 'Add a measurement'} icon="add" style={{ alignSelf: 'flex-start' }} onPress={() => setAdding(true)} />}

      {rows && rows.length === 0 && !adding && <Empty emoji="📏" title="No measurements yet" body="Weight, body fat and tape measurements all live here, newest first." />}
      {(rows ?? []).map((r) => {
        const parts = BODY_PARTS.filter(([k]) => r[k] != null).map(([k, label]) => `${label} ${fmtLength(r[k], units)}`);
        const mine = role === 'coach' || r.entered_by === me;
        return (
          <Card key={r.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <Txt v="kicker" color={p.focus}>{fromKey(r.measured_on).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Txt>
              {mine && <Pressable accessibilityRole="button" accessibilityLabel="Delete this entry" hitSlop={8} onPress={() => ask('Delete this entry?', 'This can’t be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => { const { error } = await sb.from('coach_measurements').delete().eq('id', r.id); if (error) toast(errText(error), false); else load(); } },
              ])}><Icon name="delete" size={20} color={p.muted} /></Pressable>}
            </View>
            {(r.weight_kg != null || r.body_fat_pct != null) && <Txt v="bold">{[r.weight_kg != null ? fmtWeight(r.weight_kg, units) : null, r.body_fat_pct != null ? `${r.body_fat_pct}% body fat` : null].filter(Boolean).join(' · ')}</Txt>}
            {parts.length > 0 && <Txt v="small" style={{ fontSize: 15 }}>{parts.join(' · ')}</Txt>}
            {r.note ? <Txt v="small">{r.note}</Txt> : null}
          </Card>
        );
      })}
    </View>
  );
}
