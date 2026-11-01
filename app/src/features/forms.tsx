import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Switch, TextInput, View } from 'react-native';
import { Row } from '@/components/bits';
import { DateField } from '@/components/date-field';
import { Badge } from '@/components/shell';
import { Button, Card, Chip, Empty, Field, Txt, useToast } from '@/components/ui';
import { fmtShort } from '@/lib/dates';
import { errText, type Form, type FormRequest, type Question, type QuestionType } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { F, R, usePalette } from '@/lib/theme';
import type { SectionProps } from './common';

export const QUESTION_TYPES: [QuestionType, string][] = [
  ['text', 'Short answer'], ['longtext', 'Paragraph'], ['yesno', 'Yes or no'], ['choice', 'Multiple choice'],
  ['number', 'Number'], ['scale', '1 to 10'], ['date', 'Date'], ['signature', 'Typed signature'],
];

/** True when every required question has an answer */
export const formComplete = (qs: Question[], a: Record<string, string>) => qs.every((q) => !q.required || (a[q.id] ?? '').trim() !== '');

/** A client's forms: trainer sends and reviews them; client sees what's waiting and fills it in. */
export function Forms({ client, role }: SectionProps) {
  const p = usePalette();
  const toast = useToast();
  const [reqs, setReqs] = useState<FormRequest[] | null>(null);
  const [templates, setTemplates] = useState<Form[]>([]);

  const load = useCallback(async () => {
    const [r, t] = await Promise.all([
      sb.from('coach_form_requests').select('*').eq('client_id', client.id).order('requested_at', { ascending: false }),
      role === 'coach' ? sb.from('coach_forms').select('*').eq('archived', false).order('kind', { ascending: false }).order('title') : Promise.resolve({ data: [] }),
    ]);
    setReqs((r.data as FormRequest[]) ?? []); setTemplates((t.data as Form[]) ?? []);
  }, [client.id, role]);
  useEffect(() => { load(); }, [load]);

  const send = async (f: Form) => {
    if (client.status === 'archived' || client.status === 'lead') return toast('Invite or restore this client first', false);
    const { error } = await sb.from('coach_form_requests').insert({ form_id: f.id, client_id: client.id, trainer_id: client.trainer_id, kind: f.kind, title: f.title, questions: f.questions });
    if (error) return toast(errText(error), false);
    toast(`${f.title} sent to ${client.first_name}`); load();
  };

  const pending = (reqs ?? []).filter((r) => r.status === 'pending'), done = (reqs ?? []).filter((r) => r.status === 'completed');
  const list = (rows: FormRequest[]) => (
    <Card style={{ padding: 0 }}>
      {rows.map((r, i) => (
        <Row key={r.id} icon={r.kind === 'health' ? 'health_and_safety' : 'description'} title={r.title} last={i === rows.length - 1}
          sub={r.status === 'completed' ? `Answered ${fmtShort(r.completed_at!)}` : `Sent ${fmtShort(r.requested_at)}`}
          right={r.flagged ? <Badge text="Flagged" color={p.danger} /> : r.status === 'pending' && role === 'client' ? <Badge text="To do" color={p.gold} /> : undefined}
          onPress={() => router.push({ pathname: '/forms/[rid]', params: { rid: r.id } })} />
      ))}
    </Card>
  );

  return (
    <View style={{ gap: 14 }}>
      {reqs && reqs.length === 0 && <Empty emoji="🗒️" title="No forms yet" body={role === 'coach' ? 'Send the health questionnaire or one of your own forms below.' : 'Forms from your trainer show up here.'} />}
      {pending.length > 0 && <><Txt v="h3">{role === 'client' ? 'To fill in' : 'Waiting for answers'}</Txt>{list(pending)}</>}
      {done.length > 0 && <><Txt v="h3">Answered</Txt>{list(done)}</>}
      {role === 'coach' && (
        <>
          <Txt v="h3" style={{ marginTop: 6 }}>Send a form</Txt>
          <Card style={{ padding: 0 }}>
            {templates.map((f) => <Row key={f.id} icon={f.kind === 'health' ? 'health_and_safety' : 'description'} title={f.title} sub={`${f.questions.length} questions`}
              right={<Button small kind="quiet" title="Send" onPress={() => send(f)} />} />)}
            <Row icon="add" title="Create a new form" last onPress={() => router.push('/forms/build')} />
          </Card>
        </>
      )}
    </View>
  );
}

/** Renders one question as an input (client filling in) or as an answer (read-only). */
export function QuestionInput({ q, value, onChange, readOnly }: { q: Question; value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  const p = usePalette();
  const label = `${q.label}${q.required ? '' : ' (optional)'}`;
  if (readOnly) {
    const flagged = q.type === 'yesno' && value === 'yes';
    return (
      <View style={{ marginBottom: 14, gap: 2 }}>
        <Txt v="smallBold">{q.label}</Txt>
        <Txt color={flagged ? p.danger : value ? p.ink : p.muted} v={flagged ? 'bold' : 'body'}>{value ? (q.type === 'yesno' ? (value === 'yes' ? 'Yes' : 'No') : value) : 'No answer'}</Txt>
      </View>
    );
  }
  switch (q.type) {
    case 'yesno':
    case 'choice':
    case 'scale': {
      const opts = q.type === 'yesno' ? [['yes', 'Yes'], ['no', 'No']] : q.type === 'scale' ? Array.from({ length: 10 }, (_, i) => [String(i + 1), String(i + 1)]) : (q.options ?? []).map((o) => [o, o]);
      return (
        <View style={{ marginBottom: 18 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
          <Txt v="bold" style={{ marginBottom: 8, fontSize: 15 }}>{label}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{opts.map(([k, l]) => <Chip key={k} label={l} selected={value === k} onPress={() => onChange(value === k ? '' : k)} />)}</View>
        </View>
      );
    }
    case 'date': return <DateField label={q.label} optional={!q.required} value={value || null} onChange={(v) => onChange(v ?? '')} />;
    case 'number': return <Field label={label} value={value} onChangeText={onChange} keyboardType="decimal-pad" />;
    case 'longtext': return <Field label={label} value={value} onChangeText={onChange} multiline />;
    case 'signature':
      return (
        <View style={{ marginBottom: 18 }}>
          <Txt v="bold" style={{ marginBottom: 6, fontSize: 15 }}>{label}</Txt>
          <TextInput value={value} onChangeText={onChange} accessibilityLabel={label} autoCapitalize="words" placeholder="Your full name" placeholderTextColor={p.muted}
            style={{ minHeight: 56, borderBottomWidth: 2, borderColor: p.ink, fontFamily: F.displayBold, fontSize: 24, color: p.ink, paddingHorizontal: 4 }} />
        </View>
      );
    default: return <Field label={label} value={value} onChangeText={onChange} />;
  }
}

/** Trainer's form builder: title, description, and a list of questions. */
export function FormBuilder({ initial, onSave, busy }: { initial?: Form; busy?: boolean; onSave: (f: { title: string; description: string | null; questions: Question[] }) => void }) {
  const p = usePalette();
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [qs, setQs] = useState<Question[]>(initial?.questions ?? [{ id: 'q1', type: 'text', label: '', required: true }]);
  const setQ = (i: number, patch: Partial<Question>) => setQs((all) => all.map((q, n) => (n === i ? { ...q, ...patch } : q)));
  const nextId = () => `q${Math.max(0, ...qs.map((q) => Number(q.id.replace(/\D/g, '')) || 0)) + 1}`;

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Field label="Form title" value={title} onChangeText={setTitle} placeholder="Weekly check-in" />
        <Field label="Description" hint="(optional)" value={description} onChangeText={setDescription} multiline />
      </Card>
      {qs.map((q, i) => (
        <Card key={q.id} style={{ gap: 4 }}>
          <Field label={`Question ${i + 1}`} value={q.label} onChangeText={(v) => setQ(i, { label: v })} placeholder="How did your energy feel this week?" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {QUESTION_TYPES.map(([k, l]) => <Chip key={k} label={l} selected={q.type === k} onPress={() => setQ(i, { type: k })} />)}
          </View>
          {q.type === 'choice' && <Field label="Choices, separated by commas" value={(q.options ?? []).join(', ')} onChangeText={(v) => setQ(i, { options: v.split(',').map((s) => s.trim()).filter(Boolean) })} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Switch value={!!q.required} onValueChange={(v) => setQ(i, { required: v })} trackColor={{ true: p.focus, false: p.line }} thumbColor={p.surface} accessibilityLabel="Required" />
              <Txt v="small">Required</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {i > 0 && <Button small kind="quiet" title="Up" onPress={() => setQs((a) => { const b = [...a]; [b[i - 1], b[i]] = [b[i], b[i - 1]]; return b; })} />}
              {qs.length > 1 && <Button small kind="quiet" title="Remove" onPress={() => setQs((a) => a.filter((_, n) => n !== i))} />}
            </View>
          </View>
        </Card>
      ))}
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Button kind="ghost" title="Add question" icon="add" onPress={() => setQs((a) => [...a, { id: nextId(), type: 'text', label: '', required: false }])} />
        <Button title="Save form" busy={busy} onPress={() => {
          if (!title.trim()) return toast('Give the form a title', false);
          if (qs.some((q) => !q.label.trim())) return toast('Every question needs text', false);
          if (qs.some((q) => q.type === 'choice' && (q.options ?? []).length < 2)) return toast('Multiple-choice questions need at least two choices', false);
          onSave({ title: title.trim(), description: description.trim() || null, questions: qs.map((q) => ({ ...q, label: q.label.trim() })) });
        }} />
      </View>
      <View style={{ height: 1, backgroundColor: p.line, borderRadius: R.pill }} />
    </View>
  );
}
