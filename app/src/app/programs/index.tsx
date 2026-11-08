import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Initials, Segmented } from '@/components/bits';
import { Cover } from '@/components/cover';
import { Sheet } from '@/components/sheet';
import { Button, Card, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { addDays, dayKey } from '@/lib/dates';
import { errText, type Client, type Program } from '@/lib/model';
import { compliance } from '@/lib/session';
import { cloneBlocks } from '@/lib/workouts';
import { PROGRAM_TEMPLATES, scheduleFor, type ProgramTemplate } from '@/data/program-templates';
import { sb } from '@/lib/supabase';
import { F, MAX_W, R, usePalette } from '@/lib/theme';

type Row = { client: Client; program: string; done: number; due: number; pct: number | null };

/** Programs: multi-week plans of workouts and tasks, how clients are keeping up, and Dragonfly program templates. */
export default function Programs() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [tab, setTab] = useState<'programs' | 'compliance' | 'templates'>('programs');
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState('4');

  const load = useCallback(async () => {
    const { data, error } = await sb.from('coach_programs').select('*').eq('archived', false).order('updated_at', { ascending: false });
    if (error) toast(errText(error), false);
    setPrograms((data as Program[]) ?? []);
  }, [toast]);
  const loadCompliance = useCallback(async () => {
    const today = dayKey(new Date()), from = dayKey(addDays(new Date(), -28));
    const [a, t, c] = await Promise.all([
      sb.from('coach_assignments').select('client_id, status, program_id, scheduled_on').not('program_id', 'is', null).gte('scheduled_on', from).lte('scheduled_on', today),
      sb.from('coach_tasks').select('client_id, done_at, program_id, due_on').not('program_id', 'is', null).gte('due_on', from).lte('due_on', today),
      sb.from('coach_clients').select('*').in('status', ['active', 'invited']),
    ]);
    const names = new Map((programs ?? []).map((x) => [x.id, x.name]));
    const by = new Map<string, Row>();
    for (const cl of (c.data as Client[]) ?? []) by.set(cl.id, { client: cl, program: '', done: 0, due: 0, pct: null });
    for (const x of (a.data ?? []) as { client_id: string; status: string; program_id: string }[]) {
      const r = by.get(x.client_id); if (!r) continue;
      r.due++; if (x.status === 'done') r.done++; r.program ||= names.get(x.program_id) ?? 'Program';
    }
    for (const x of (t.data ?? []) as { client_id: string; done_at: string | null; program_id: string }[]) {
      const r = by.get(x.client_id); if (!r) continue;
      r.due++; if (x.done_at) r.done++; r.program ||= names.get(x.program_id) ?? 'Program';
    }
    setRows([...by.values()].filter((r) => r.due).map((r) => ({ ...r, pct: compliance(r.done, r.due) })).sort((x, y) => (x.pct ?? 0) - (y.pct ?? 0)));
  }, [programs]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useFocusEffect(useCallback(() => { if (tab === 'compliance' && programs) loadCompliance(); }, [tab, programs, loadCompliance]));

  const list = useMemo(() => (programs ?? []).filter((x) => q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => x.name.toLowerCase().includes(w))), [programs, q]);
  const create = async () => {
    const n = Number(weeks);
    if (!name.trim()) return;
    if (!Number.isInteger(n) || n < 1 || n > 52) return toast('Use 1 to 52 weeks', false);
    const { data, error } = await sb.from('coach_programs').insert({ trainer_id: app.trainer?.user_id, name: name.trim(), weeks: n }).select('id').single();
    if (error) return toast(errText(error), false);
    setCreating(false); setName(''); setWeeks('4');
    router.push({ pathname: '/programs/[id]', params: { id: data.id } });
  };

  /** Copy a Dragonfly template into the trainer's own workouts and a new program, then open it */
  const [installing, setInstalling] = useState<string | null>(null);
  const install = async (t: ProgramTemplate) => {
    const tid = app.trainer?.user_id;
    if (!tid) return;
    setInstalling(t.key);
    try {
      const { data: ws, error } = await sb.from('coach_workouts').insert(t.workouts.map((w) => ({
        trainer_id: tid, name: `${t.name}: ${w.name}`.slice(0, 120), description: w.description || null, blocks: cloneBlocks(w.blocks), cover: t.cover,
      }))).select('id, name');
      if (error) throw error;
      // Keep template order (returned rows follow insert order, but match by name to be safe)
      const rows = (ws as { id: string; name: string }[]) ?? [];
      const ids = t.workouts.map((w, i) => rows.find((x) => x.name === `${t.name}: ${w.name}`.slice(0, 120))?.id ?? rows[i]?.id);
      if (ids.some((x) => !x)) throw new Error('Couldn’t copy every workout. Try again.');
      const { data: prog, error: e2 } = await sb.from('coach_programs').insert({
        trainer_id: tid, name: t.name, weeks: t.weeks, cover: t.cover, schedule: scheduleFor(t, ids as string[]),
        description: `${t.description}\n\nProgression: ${t.progression}`.slice(0, 4000),
      }).select('id').single();
      if (e2) throw e2;
      toast(`${t.name} added to your programs`);
      router.push({ pathname: '/programs/[id]', params: { id: prog.id } });
    } catch (e) { toast(errText(e), false); } finally { setInstalling(null); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Programs' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          <Segmented value={tab} onChange={setTab} options={[['programs', 'Programs'], ['compliance', 'Compliance'], ['templates', 'Templates']]} />
          {tab === 'programs' && <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, height: 46 }}>
              <Icon name="search" size={20} color={p.muted} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search programs" placeholderTextColor={p.muted} accessibilityLabel="Search programs" style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: p.ink, height: 44 }} />
            </View>
            {programs === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : list.length === 0 ? (
              <Empty emoji="🗓️" title={programs.length ? 'No programs match' : 'Create your first program'}
                body="A program is a set of workouts and check-in tasks laid out over weeks, like a 5-week strength block. Assign it once and everything lands on your client’s calendar." />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {list.map((x) => {
                  const workouts = x.schedule.filter((s) => (s.kind ?? 'workout') === 'workout').length;
                  return (
                    <Pressable key={x.id} accessibilityRole="link" accessibilityLabel={x.name} onPress={() => router.push({ pathname: '/programs/[id]', params: { id: x.id } })}
                      style={({ pressed }) => ({ flexGrow: 1, flexBasis: 160, maxWidth: 320, gap: 8, opacity: pressed ? 0.8 : 1 })}>
                      <View style={{ aspectRatio: 16 / 10, borderRadius: R.md, overflow: 'hidden', alignItems: 'stretch' }}>
                        <Cover name={x.name} cover={x.cover} size={320} photo />
                      </View>
                      <View>
                        <Txt v="bold" numberOfLines={2}>{x.name}</Txt>
                        <Txt v="small">{x.weeks} week{x.weeks === 1 ? '' : 's'} · {workouts} workout{workouts === 1 ? '' : 's'}</Txt>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>}
          {tab === 'compliance' && (rows === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 30 }} /> : rows.length === 0
            ? <Empty emoji="📈" title="Nobody on a program yet" body="When clients have program workouts and tasks due, you’ll see who’s keeping up here, lowest first." />
            : <>
              <Txt v="smallBold">By lowest compliance · last 4 weeks</Txt>
              <Card style={{ padding: 0 }}>
                {rows.map((r, i) => (
                  <Pressable key={r.client.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/clients/[id]/workouts', params: { id: r.client.id } })}
                    style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
                    <Initials name={r.client.name} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Txt v="bold">{r.client.name}</Txt>
                      <Txt v="small">{r.program} · {r.done} of {r.due} done</Txt>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: p.line, overflow: 'hidden' }}>
                        <View style={{ width: `${r.pct ?? 0}%`, height: 6, backgroundColor: (r.pct ?? 0) < 50 ? p.danger : (r.pct ?? 0) < 80 ? p.gold : p.good }} />
                      </View>
                    </View>
                    <Txt v="h3">{r.pct ?? 0}%</Txt>
                  </Pressable>
                ))}
              </Card>
            </>)}
          {tab === 'templates' && (
            <View style={{ gap: 10 }}>
              <Txt v="small">Ready-made programs. Using one copies its workouts into your library and creates a program you can edit and assign.</Txt>
              {PROGRAM_TEMPLATES.map((t) => (
                <Card key={t.key} style={{ gap: 6 }}>
                  <Txt v="kicker" color={p.focus}>{t.focus} · {t.level} · {t.weeks} weeks · {t.perWeek}× a week</Txt>
                  <Txt v="bold">{t.name}</Txt>
                  <Txt v="small">{t.description}</Txt>
                  <Txt v="small">Workouts: {t.workouts.map((w) => w.name).join(', ')}</Txt>
                  <Button small title="Use this program" busy={installing === t.key} disabled={!!installing} onPress={() => install(t)} style={{ alignSelf: 'flex-start' }} />
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      {tab === 'programs' && <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
        <Button kind="accent" icon="add" title="Create program" onPress={() => setCreating(true)} />
      </View>}
      <Sheet visible={creating} onClose={() => setCreating(false)} title="New program">
        <Field label="Program name" value={name} onChangeText={setName} placeholder="5-week strength block" autoFocus />
        <View style={{ width: 160 }}><Field label="Weeks" value={weeks} onChangeText={setWeeks} keyboardType="number-pad" /></View>
        <Button title="Create" disabled={!name.trim()} onPress={create} style={{ alignSelf: 'flex-start' }} />
      </Sheet>
    </View>
  );
}
