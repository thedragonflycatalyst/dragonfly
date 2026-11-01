import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Badge } from '@/components/shell';
import { Button, Card, Empty, Txt, useToast } from '@/components/ui';
import { formComplete, QuestionInput } from '@/features/forms';
import { useApp } from '@/lib/app-state';
import { fmtShort } from '@/lib/dates';
import { errText, type FormRequest } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

/** One form sent to a client: the client fills it in; the trainer (or client, after) reads the answers. */
export default function FormScreen() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { rid } = useLocalSearchParams<{ rid: string }>();
  const [r, setR] = useState<FormRequest | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { sb.from('coach_form_requests').select('*').eq('id', rid).maybeSingle().then(({ data }) => { setR((data as FormRequest) ?? null); setAnswers((data as FormRequest)?.answers ?? {}); }); }, [rid]);

  if (r === undefined) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!r) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔎" title="Form not found" /></View>;
  const filling = r.status === 'pending' && app.mode === 'client';

  const submit = async () => {
    if (!formComplete(r.questions, answers)) return toast('Please answer every required question', false);
    setBusy(true);
    try {
      const { error } = await sb.rpc('coach_submit_form', { p_request: r.id, p_answers: answers });
      if (error) throw error;
      const flagged = r.kind === 'health' && r.questions.some((q) => q.type === 'yesno' && answers[q.id] === 'yes');
      toast(flagged ? 'Sent. Please check with your doctor before becoming much more active.' : 'Sent to your trainer');
      router.back();
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: r.title }} />
      <View style={{ width: '100%', maxWidth: 680, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Txt v="h1">{r.title}</Txt>
          {r.flagged && <Badge text="Flagged" color={p.danger} />}
        </View>
        <Txt v="small">{r.status === 'completed' ? `Answered ${fmtShort(r.completed_at!)}` : `Sent ${fmtShort(r.requested_at)}`}</Txt>
        {r.kind === 'health' && filling && <Card><Txt v="small" style={{ fontSize: 15 }}>These questions help your trainer keep you safe. If you answer yes to any, check with your doctor before becoming much more physically active. This isn’t medical advice.</Txt></Card>}
        {r.flagged && app.mode === 'coach' && <Card style={{ borderWidth: 1.5, borderColor: p.danger }}><Txt v="small" style={{ fontSize: 15 }}>At least one answer is yes. Talk it through with your client and consider asking for medical clearance before training.</Txt></Card>}
        <Card>
          {r.questions.map((q) => <QuestionInput key={q.id} q={q} value={answers[q.id] ?? ''} readOnly={!filling} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />)}
        </Card>
        {filling && <Button title="Send to my trainer" busy={busy} onPress={submit} style={{ alignSelf: 'flex-start' }} />}
      </View>
    </ScrollView>
  );
}
