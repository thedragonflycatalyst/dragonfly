// Admin: where the library needs a person. The AI decides suggestions on its own; trainers escalate the odd case it can't
// handle, and anyone can report an entry. Recent AI additions are listed so a bad one can be taken back.
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { Button, Card, Chip, Field, Txt, useToast } from '@/components/ui';
import { loadLibraryExtras, REPORT_KINDS, type Pending, type Report } from '@/features/library-extras';
import { Page } from '@/features/settings-page';
import { byRef } from '@/lib/library';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

export default function LibraryReview() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [recent, setRecent] = useState<{ ref: string; data: unknown[]; created_at: string }[]>([]);
  const load = useCallback(async () => {
    const a = await sb.rpc('dragonfly_is_admin');
    setAdmin(a.data === true);
    if (a.data !== true) return;
    const [s, r, x] = await Promise.all([
      sb.from('coach_exercise_submissions').select('id, created_at, exercise, ai_decision, reason, match_ref, proposal, outcome, escalated_from, escalation_note')
        .in('outcome', ['escalated', 'pending']).order('created_at').limit(100),
      sb.from('coach_exercise_reports').select('id, created_at, ref, name, kind, note, status').eq('status', 'open').order('created_at').limit(200),
      sb.from('coach_library_extra').select('ref, data, created_at').order('created_at', { ascending: false }).limit(30),
    ]);
    setPending((s.data as Pending[]) ?? []);
    setReports((r.data as Report[]) ?? []);
    setRecent((x.data as typeof recent) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <Page title="Library review">
      <Stack.Screen options={{ title: 'Library review' }} />
      {admin === false && <Txt>Only Dragonfly admins can review the library.</Txt>}
      {admin && <>
        <SectionLabel>{`Escalated by trainers (${pending.length})`}</SectionLabel>
        {pending.length === 0 && <Txt v="small" style={{ marginBottom: 16 }}>Nothing waiting. The AI review handles suggestions on its own.</Txt>}
        {pending.map((s) => <Suggestion key={s.id} s={s} onDone={load} />)}
        <SectionLabel>{`Reports (${reports.length})`}</SectionLabel>
        {reports.length === 0 && <Txt v="small">No open reports.</Txt>}
        {reports.map((r) => <ReportCard key={r.id} r={r} onDone={load} />)}
        <SectionLabel>Recently added by the AI review</SectionLabel>
        {recent.length === 0 && <Txt v="small">None yet.</Txt>}
        {recent.map((x) => <Recent key={x.ref} x={x} onDone={load} />)}
      </>}
    </Page>
  );
}

function Suggestion({ s, onDone }: { s: Pending; onDone: () => void }) {
  const p = usePalette();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const decide = async (approve: boolean) => {
    setBusy(approve ? 'yes' : 'no');
    const { error } = await sb.rpc('coach_review_submission', { sid: s.id, approve, note: note.trim() || null });
    setBusy(null);
    if (error) return toast(errText(error), false);
    toast(approve ? 'Approved: it’s in the library' : 'Declined');
    if (approve) await loadLibraryExtras();
    onDone();
  };
  const pr = s.proposal;
  const row = pr?.kind === 'add' ? pr.row : null;
  const target = pr?.kind === 'alias' ? byRef(pr.ref) : undefined;
  const canAdd = !!pr && s.escalated_from !== 'added' && s.escalated_from !== 'alias';
  return (
    <Card style={{ marginBottom: 12, gap: 6 }}>
      <Txt v="bold">{s.exercise.name}</Txt>
      <Txt v="small">Suggested {new Date(s.created_at).toLocaleDateString()} · {s.exercise.category} · {s.exercise.gear.join(', ') || 'no equipment given'}</Txt>
      {s.exercise.description ? <Txt v="small" color={p.ink}>{s.exercise.description}</Txt> : null}
      {s.escalation_note ? <Txt><Txt v="bold">Trainer says: </Txt>{s.escalation_note}</Txt> : null}
      <Txt v="small">AI decided: {s.escalated_from ?? s.ai_decision}</Txt>
      <View style={{ borderLeftWidth: 3, borderLeftColor: p.focus, paddingLeft: 10, gap: 4, marginVertical: 4 }}>
        {!pr ? <Txt v="small">No draft entry from the AI. Decline with a note, or ask the trainer to resubmit with more detail.</Txt>
          : pr.kind === 'alias'
          ? <Txt>AI: the same as <Txt v="bold">{target?.name ?? pr.ref}</Txt>. Search names: {pr.names.join(', ')}</Txt>
          : <>
            <Txt>AI: a new variation. Add as <Txt v="bold">{String(row?.[1])}</Txt></Txt>
            <Txt v="small">{[row?.[3], row?.[5], (row?.[6] as string[] | undefined)?.join(', '), (row?.[8] as string[] | undefined)?.join(', ')].filter(Boolean).join(' · ')}</Txt>
            {(['Setup', 'Movement', 'Cues'] as const).map((h, i) => <Txt key={h} v="small" color={p.ink}><Txt v="bold">{h}: </Txt>{String(row?.[9 + i] ?? '')}</Txt>)}
          </>}
        {s.reason ? <Txt v="small">Why: {s.reason}</Txt> : null}
      </View>
      <Field label="Note to the trainer" hint="(optional)" value={note} onChangeText={setNote} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button small title={canAdd ? 'Add it to the library' : 'Uphold the trainer'} disabled={!pr && canAdd} busy={busy === 'yes'} onPress={() => decide(true)} />
        <Button small kind="ghost" title={canAdd ? 'Keep it out' : 'Agree with the AI'} busy={busy === 'no'} onPress={() => decide(false)} />
      </View>
    </Card>
  );
}

function ReportCard({ r, onDone }: { r: Report; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const close = async (status: 'resolved' | 'dismissed') => {
    const { error } = await sb.from('coach_exercise_reports').update({ status, admin_note: note.trim() || null }).eq('id', r.id);
    if (error) return toast(errText(error), false);
    onDone();
  };
  return (
    <Card style={{ marginBottom: 12, gap: 6 }}>
      <Txt v="bold">{r.name}</Txt>
      <View style={{ flexDirection: 'row' }}><Chip label={REPORT_KINDS.find(([k]) => k === r.kind)?.[1] ?? r.kind} selected /></View>
      {r.note ? <Txt>{r.note}</Txt> : null}
      <Txt v="small">{new Date(r.created_at).toLocaleDateString()} · {r.ref}</Txt>
      <Field label="What was done" hint="(optional)" value={note} onChangeText={setNote} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {r.ref.startsWith('lib:x-') && <Button small kind="ghost" title="Remove from library" onPress={async () => {
          const { error } = await sb.rpc('coach_remove_library_item', { item_ref: r.ref });
          if (error) return toast(errText(error), false);
          await loadLibraryExtras(); await close('resolved');
        }} />}
        <Button small title="Resolved" onPress={() => close('resolved')} />
        <Button small kind="ghost" title="Dismiss" onPress={() => close('dismissed')} />
      </View>
    </Card>
  );
}

function Recent({ x, onDone }: { x: { ref: string; data: unknown[]; created_at: string }; onDone: () => void }) {
  const toast = useToast();
  const remove = async () => {
    const { error } = await sb.rpc('coach_remove_library_item', { item_ref: x.ref });
    if (error) return toast(errText(error), false);
    toast('Removed from the library'); await loadLibraryExtras(); onDone();
  };
  return (
    <Card style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Txt v="bold">{String(x.data[1])}</Txt>
        <Txt v="small">{[x.data[3], (x.data[8] as string[] | undefined)?.join(', '), new Date(x.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}</Txt>
      </View>
      <Button small kind="quiet" title="Remove" onPress={remove} />
    </Card>
  );
}
