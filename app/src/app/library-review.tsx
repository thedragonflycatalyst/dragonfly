// Admin: the shared library's review queue. Trainers' suggestions arrive here after the AI pre-screen; nothing joins the
// library until approved here. Reports of redundant or problematic exercises are answered here too.
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
  const load = useCallback(async () => {
    const a = await sb.rpc('dragonfly_is_admin');
    setAdmin(a.data === true);
    if (a.data !== true) return;
    const [s, r] = await Promise.all([
      sb.from('coach_exercise_submissions').select('id, created_at, exercise, ai_decision, reason, match_ref, proposal').eq('outcome', 'pending').order('created_at').limit(100),
      sb.from('coach_exercise_reports').select('id, created_at, ref, name, kind, note, status').eq('status', 'open').order('created_at').limit(200),
    ]);
    setPending((s.data as Pending[]) ?? []);
    setReports((r.data as Report[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <Page title="Library review">
      <Stack.Screen options={{ title: 'Library review' }} />
      {admin === false && <Txt>Only Dragonfly admins can review the library.</Txt>}
      {admin && <>
        <SectionLabel>{`Suggestions (${pending.length})`}</SectionLabel>
        {pending.length === 0 && <Txt v="small" style={{ marginBottom: 16 }}>Nothing waiting.</Txt>}
        {pending.map((s) => <Suggestion key={s.id} s={s} onDone={load} />)}
        <SectionLabel>{`Reports (${reports.length})`}</SectionLabel>
        {reports.length === 0 && <Txt v="small">No open reports.</Txt>}
        {reports.map((r) => <ReportCard key={r.id} r={r} onDone={load} />)}
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
  const row = pr.kind === 'add' ? (pr.row as string[] & unknown[]) : null;
  const target = pr.kind === 'alias' ? byRef(pr.ref) : undefined;
  return (
    <Card style={{ marginBottom: 12, gap: 6 }}>
      <Txt v="bold">{s.exercise.name}</Txt>
      <Txt v="small">Suggested {new Date(s.created_at).toLocaleDateString()} · {s.exercise.category} · {s.exercise.gear.join(', ') || 'no equipment given'}</Txt>
      {s.exercise.description ? <Txt v="small" color={p.ink}>{s.exercise.description}</Txt> : null}
      <View style={{ borderLeftWidth: 3, borderLeftColor: p.focus, paddingLeft: 10, gap: 4, marginVertical: 4 }}>
        {pr.kind === 'alias'
          ? <Txt>AI: the same as <Txt v="bold">{target?.name ?? pr.ref}</Txt>. Add as search names: {pr.names.join(', ')}</Txt>
          : <>
            <Txt>AI: a new variation. Add as <Txt v="bold">{String(row?.[1])}</Txt></Txt>
            <Txt v="small">{[row?.[3], row?.[5], (row?.[6] as string[] | undefined)?.join(', '), (row?.[8] as string[] | undefined)?.join(', ')].filter(Boolean).join(' · ')}</Txt>
            {(['Setup', 'Movement', 'Cues'] as const).map((h, i) => <Txt key={h} v="small" color={p.ink}><Txt v="bold">{h}: </Txt>{String(row?.[9 + i] ?? '')}</Txt>)}
          </>}
        {s.reason ? <Txt v="small">Why: {s.reason}</Txt> : null}
      </View>
      <Field label="Note to the trainer" hint="(optional)" value={note} onChangeText={setNote} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button small title="Approve" busy={busy === 'yes'} onPress={() => decide(true)} />
        <Button small kind="ghost" title="Decline" busy={busy === 'no'} onPress={() => decide(false)} />
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
        <Button small title="Resolved" onPress={() => close('resolved')} />
        <Button small kind="ghost" title="Dismiss" onPress={() => close('dismissed')} />
      </View>
    </Card>
  );
}
