import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { ask } from '@/lib/ask';
import { addDays, dayKey, fromKey } from '@/lib/dates';
import { errText, type Habit } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';
import type { SectionProps } from './common';

const AUTO_UNIT: Record<string, string> = { steps: 'steps', sleep_hours: 'hours of sleep', water_ml: 'ml', active_kcal: 'active kcal' };

/** The last 7 days, oldest first, as YYYY-MM-DD */
export const lastWeek = (today = new Date()) => Array.from({ length: 7 }, (_, i) => dayKey(addDays(today, i - 6)));

/** Habits: the trainer sets them; the client ticks off each day. Shows this week at a glance. */
export function Habits({ client, role }: SectionProps) {
  const p = usePalette();
  const toast = useToast();
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [checks, setChecks] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [days, setDays] = useState('7');
  const week = lastWeek();

  const load = useCallback(async () => {
    const { data } = await sb.from('coach_habits').select('*').eq('client_id', client.id).order('created_at');
    const list = (data as Habit[]) ?? [];
    setHabits(list);
    if (list.length) {
      const { data: c } = await sb.from('coach_habit_checks').select('habit_id,day').in('habit_id', list.map((h) => h.id)).gte('day', week[0]);
      setChecks(new Set((c ?? []).map((x) => `${x.habit_id}:${x.day}`)));
    }
  }, [client.id, week[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const d = Number(days);
    if (!title.trim()) return toast('Name the habit', false);
    if (!Number.isInteger(d) || d < 1 || d > 7) return toast('Days per week must be 1 to 7', false);
    const { error } = await sb.from('coach_habits').insert({ client_id: client.id, trainer_id: client.trainer_id, title: title.trim(), details: details.trim() || null, days_per_week: d });
    if (error) return toast(errText(error), false);
    setTitle(''); setDetails(''); setDays('7'); toast('Habit added'); load();
  };
  const toggle = async (h: Habit, day: string) => {
    if (role !== 'client') return;
    const key = `${h.id}:${day}`, on = checks.has(key);
    setChecks((s) => { const n = new Set(s); if (on) n.delete(key); else n.add(key); return n; });
    const { error } = on ? await sb.from('coach_habit_checks').delete().eq('habit_id', h.id).eq('day', day)
      : await sb.from('coach_habit_checks').insert({ habit_id: h.id, day });
    if (error) { toast(errText(error), false); load(); }
  };

  const active = (habits ?? []).filter((h) => h.active), past = (habits ?? []).filter((h) => !h.active);
  return (
    <View style={{ gap: 14 }}>
      {role === 'coach' && (
        <Card>
          <Txt v="h3" style={{ marginBottom: 12 }}>New reminder</Txt>
          <Field label="Habit" value={title} onChangeText={setTitle} placeholder="Drink 80 oz of water" />
          <Field label="Details" hint="(optional)" value={details} onChangeText={setDetails} placeholder="Keep a bottle at your desk" />
          <View style={{ width: 160 }}><Field label="Days per week" value={days} onChangeText={setDays} keyboardType="number-pad" /></View>
          <Button title="Add reminder" style={{ alignSelf: 'flex-start' }} onPress={add} />
        </Card>
      )}
      {habits && active.length === 0 && <Empty emoji="🌿" title="No reminders yet" body={role === 'coach' ? 'Small daily reminders, like water, steps or sleep, that your client ticks off.' : 'Your trainer will add daily reminders here for you to tick off.'} />}
      {active.map((h) => {
        const done = week.filter((d) => checks.has(`${h.id}:${d}`)).length;
        return (
          <Card key={h.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt v="bold">{h.icon ? `${h.icon} ` : ""}{h.title}</Txt>
                {h.details ? <Txt v="small">{h.details}</Txt> : null}
                {h.auto_metric ? <Txt v="small" color={p.focus}>⚡ Ticks itself at {Number(h.auto_target).toLocaleString()} {AUTO_UNIT[h.auto_metric]} (from synced data)</Txt> : null}
                <Txt v="small" color={done >= h.days_per_week ? p.good : p.muted}>{done} of {h.days_per_week} days in the last week</Txt>
              </View>
              {role === 'coach' && <Button small kind="quiet" title="Stop" onPress={() => ask('Stop this reminder?', 'It moves to past reminders. Its history is kept.', [
                { text: 'Cancel', style: 'cancel' }, { text: 'Stop', onPress: async () => { await sb.from('coach_habits').update({ active: false }).eq('id', h.id); load(); } }])} />}
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {week.map((d) => {
                const on = checks.has(`${h.id}:${d}`);
                const label = fromKey(d).toLocaleDateString(undefined, { weekday: 'narrow' });
                return (
                  <Pressable key={d} disabled={role !== 'client'} onPress={() => toggle(h, d)} accessibilityRole={role === 'client' ? 'checkbox' : undefined}
                    accessibilityState={{ checked: on }} accessibilityLabel={`${h.title}, ${fromKey(d).toLocaleDateString(undefined, { weekday: 'long' })}`}
                    style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? p.good : p.soft, borderWidth: d === dayKey(new Date()) ? 2 : 0, borderColor: p.ink }}>
                      {on && <Icon name="check" size={20} color={p.onAccent} />}
                    </View>
                    <Txt v="small">{label}</Txt>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        );
      })}
      {past.length > 0 && <Txt v="small">Past reminders: {past.map((h) => h.title).join(', ')}</Txt>}
    </View>
  );
}
