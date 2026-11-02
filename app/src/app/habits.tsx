import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Segmented, SectionLabel } from '@/components/bits';
import { ClientPicker, ColorPicker, EmojiPicker, Fab, matches, SearchBox, Toggle, useClientList } from '@/components/pickers';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Empty, Field, Txt, useToast } from '@/components/ui';
import { confirm } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { COLORS } from '@/lib/business';
import { addDays, dayKey } from '@/lib/dates';
import { errText, type Habit } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

type LibHabit = { id: string; trainer_id: string; name: string; details: string | null; icon: string; color: string; once: boolean; days_per_week: number; coaching: boolean; archived: boolean; created_at: string };
const ICONS = ['✅', '💧', '🚶', '🏃', '😴', '🥗', '🍎', '🥩', '🧘', '📵', '☀️', '🧴', '💊', '📖', '✍️', '🙏', '🧊', '🚭', '🍷', '☕', '🍬', '🥦', '⚖️', '📸', '💪', '🦵', '🫁', '🎯', '⏰', '🌙'];

/** Habits: your library of habits (with icon and colour), who's doing each one, and how this week is going */
export default function HabitsScreen() {
  const p = usePalette();
  const toast = useToast();
  const [shelf, setShelf] = useState<'current' | 'archived'>('current');
  const [lib, setLib] = useState<LibHabit[] | null>(null);
  const [assigned, setAssigned] = useState<Habit[]>([]);
  const [checks, setChecks] = useState<{ habit_id: string; day: string }[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<LibHabit | 'new' | null>(null);
  const { clients } = useClientList();
  const weekStart = dayKey(addDays(new Date(), -6));

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([sb.from('coach_habit_library').select('*').order('created_at'), sb.from('coach_habits').select('*').eq('active', true)]);
    if (a.error) toast(errText(a.error), false);
    setLib((a.data as LibHabit[]) ?? []);
    const hs = (b.data as (Habit & { library_id: string | null })[]) ?? [];
    setAssigned(hs);
    if (hs.length) { const { data } = await sb.from('coach_habit_checks').select('habit_id, day').in('habit_id', hs.map((h) => h.id)).gte('day', weekStart); setChecks(data ?? []); }
  }, [toast, weekStart]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const of = (l: LibHabit) => assigned.filter((h) => (h as Habit & { library_id?: string }).library_id === l.id);
  const weekPct = (hs: Habit[]) => {
    if (!hs.length) return null;
    const want = hs.reduce((a, h) => a + (h.days_per_week || 7), 0);
    const got = checks.filter((c) => hs.some((h) => h.id === c.habit_id)).length;
    return Math.min(100, Math.round((got / want) * 100));
  };
  const list = (lib ?? []).filter((l) => l.archived === (shelf === 'archived') && matches(q, l.name, l.details));

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Habits' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <Segmented value={shelf} onChange={setShelf} options={[['current', 'Current'], ['archived', 'Archived']]} />
          <SearchBox value={q} onChange={setQ} placeholder="Search habits" />
          {lib === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : list.length === 0 ? (
            <Empty emoji="🌱" title={shelf === 'archived' ? 'Nothing archived' : 'Build your habit library'} body="Small daily wins like 8,000 steps, 3 litres of water or 7 hours of sleep. Create a habit once, give it to as many clients as you like, and see who’s keeping up." />
          ) : (
            <Card style={{ padding: 0 }}>
              {list.map((l, i) => {
                const hs = of(l), pct = weekPct(hs);
                return (
                  <Pressable key={l.id} onPress={() => setOpen(l)} accessibilityRole="button" accessibilityLabel={l.name}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.75 : 1 })}>
                    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: l.color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22 }}>{l.icon}</Text></View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt v="bold">{l.name}</Txt>
                      <Txt v="small">{l.once ? 'One-off' : l.days_per_week === 7 ? 'Every day' : `${l.days_per_week} days a week`} · {hs.length} client{hs.length === 1 ? '' : 's'}</Txt>
                    </View>
                    {pct != null && <View style={{ alignItems: 'flex-end' }}><Txt v="h3" color={pct >= 80 ? p.good : pct >= 50 ? p.gold : p.danger}>{pct}%</Txt><Txt v="small">this week</Txt></View>}
                  </Pressable>
                );
              })}
            </Card>
          )}
        </View>
      </ScrollView>
      {shelf === 'current' && <Fab title="Create habit" onPress={() => setOpen('new')} />}
      <HabitSheet h={open} onClose={() => setOpen(null)} onSaved={load} assigned={open && open !== 'new' ? of(open) : []} checks={checks}
        clients={(clients ?? []).map((c) => ({ id: c.id, name: c.name }))} />
    </View>
  );
}

function HabitSheet({ h, onClose, onSaved, assigned, checks, clients }: {
  h: LibHabit | 'new' | null; onClose: () => void; onSaved: () => void; assigned: Habit[]; checks: { habit_id: string; day: string }[]; clients: { id: string; name: string }[];
}) {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const ed = h && h !== 'new' ? h : null;
  const [seen, setSeen] = useState<typeof h>(null);
  const [f, setF] = useState({ name: '', details: '', icon: '✅', color: COLORS[0], once: false, days: 7, coaching: true });
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(false);
  if (h !== seen) {
    setSeen(h);
    setF({ name: ed?.name ?? '', details: ed?.details ?? '', icon: ed?.icon ?? '✅', color: ed?.color ?? COLORS[0], once: ed?.once ?? false, days: ed?.days_per_week ?? 7, coaching: ed?.coaching ?? true });
  }
  const save = async (): Promise<string | null> => {
    if (!f.name.trim()) { toast('Name the habit', false); return null; }
    setBusy(true);
    const row = { trainer_id: app.trainer?.user_id, name: f.name.trim(), details: f.details.trim() || null, icon: f.icon, color: f.color, once: f.once, days_per_week: f.days, coaching: f.coaching };
    const res = ed ? await sb.from('coach_habit_library').update(row).eq('id', ed.id).select('id').single() : await sb.from('coach_habit_library').insert(row).select('id').single();
    if (!res.error && ed) await sb.from('coach_habits').update({ title: row.name, details: row.details, icon: row.icon, color: row.color, once: row.once, days_per_week: row.days_per_week }).eq('library_id', ed.id);
    setBusy(false);
    if (res.error) { toast(errText(res.error), false); return null; }
    onSaved(); return res.data.id as string;
  };
  const assign = async (ids: string[]) => {
    const libId = ed?.id ?? (await save());
    if (!libId) return;
    const have = new Set(assigned.map((a) => a.client_id));
    const add = ids.filter((id) => !have.has(id));
    const drop = assigned.filter((a) => !ids.includes(a.client_id)).map((a) => a.id);
    const rows = add.map((client_id) => ({ client_id, trainer_id: app.trainer?.user_id, library_id: libId, title: f.name.trim(), details: f.details.trim() || null, icon: f.icon, color: f.color, once: f.once, days_per_week: f.days }));
    const r1 = rows.length ? await sb.from('coach_habits').insert(rows) : { error: null };
    const r2 = drop.length ? await sb.from('coach_habits').update({ active: false }).in('id', drop) : { error: null };
    if (r1.error || r2.error) return toast(errText(r1.error ?? r2.error), false);
    toast(`${ids.length} client${ids.length === 1 ? '' : 's'} on this habit`); onSaved();
  };
  const archive = async () => {
    if (!ed) return;
    await sb.from('coach_habit_library').update({ archived: !ed.archived }).eq('id', ed.id);
    if (!ed.archived) await sb.from('coach_habits').update({ active: false }).eq('library_id', ed.id);
    toast(ed.archived ? 'Restored' : 'Archived and taken off clients’ lists'); onSaved(); onClose();
  };
  const remove = async () => {
    if (!ed || !(await confirm(`Delete ${ed.name}?`, 'Clients’ past ticks stay in their history.', 'Delete', true))) return;
    await sb.from('coach_habits').update({ active: false }).eq('library_id', ed.id);
    const { error } = await sb.from('coach_habit_library').delete().eq('id', ed.id);
    if (error) return toast(errText(error), false);
    onSaved(); onClose();
  };
  const weekTicks = (hid: string) => checks.filter((c) => c.habit_id === hid).length;
  return (
    <Sheet visible={!!h} onClose={onClose} title={ed ? ed.name : 'Create habit'}>
      <Field label="Name" value={f.name} onChangeText={(name) => setF({ ...f, name })} placeholder="Drink 3 litres of water" />
      <Field label="Details" hint="(optional)" value={f.details} onChangeText={(details) => setF({ ...f, details })} placeholder="Keep a bottle at your desk" />
      <Txt v="bold" style={{ marginBottom: 8 }}>How often</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <Chip label="Once" selected={f.once} onPress={() => setF({ ...f, once: true })} />
        {[7, 6, 5, 4, 3, 2, 1].map((d) => <Chip key={d} label={d === 7 ? 'Every day' : `${d}× a week`} selected={!f.once && f.days === d} onPress={() => setF({ ...f, once: false, days: d })} />)}
      </View>
      <Txt v="bold" style={{ marginBottom: 8 }}>Colour</Txt>
      <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} colors={COLORS} />
      <Txt v="bold" style={{ marginTop: 14, marginBottom: 8 }}>Icon</Txt>
      <EmojiPicker value={f.icon} onChange={(icon) => setF({ ...f, icon })} options={ICONS} />
      <Toggle label="Coaching" sub="Flag missed days in check-ins so you can follow up" value={f.coaching} onChange={(coaching) => setF({ ...f, coaching })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
        <Button title={ed ? 'Save' : 'Create'} icon="check" busy={busy} onPress={async () => { if (await save()) { toast('Saved'); if (!ed) onClose(); } }} />
        <Button kind="ghost" icon="group_add" title="Assign to clients" onPress={() => setPick(true)} />
      </View>
      {ed && <>
        <SectionLabel>{`Clients · this week`}</SectionLabel>
        {assigned.length === 0 ? <Txt v="small">Nobody yet.</Txt> : assigned.map((a) => (
          <View key={a.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Txt>{clients.find((c) => c.id === a.client_id)?.name ?? 'Client'}</Txt>
            <Txt v="bold" color={weekTicks(a.id) >= a.days_per_week ? p.good : p.ink}>{weekTicks(a.id)} / {f.once ? 1 : a.days_per_week}</Txt>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Button kind="ghost" icon="archive" title={ed.archived ? 'Restore' : 'Archive'} onPress={archive} />
          <Button kind="danger" icon="delete" title="Delete" onPress={remove} />
        </View>
      </>}
      <ClientPicker visible={pick} onClose={() => setPick(false)} title="Who’s doing this habit" value={assigned.map((a) => a.client_id)} onDone={assign} />
    </Sheet>
  );
}
