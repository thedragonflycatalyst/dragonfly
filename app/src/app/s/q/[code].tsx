// The trainer's open survey (link or QR code they hand out any time). Signed-in clients answer as themselves;
// anyone else answers anonymously, with an optional first name.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Chip, Field, Txt } from '@/components/ui';
import { LinkPage } from '@/features/link-page';
import { ReviewSites } from '@/features/review-sites';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type V = { trainer_name: string; question: string; client_first: string | null };

export default function OpenSurvey() {
  const p = usePalette();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [v, setV] = useState<V | null | undefined>(undefined);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    void sb.rpc('coach_open_survey_view', { p_code: code }).then(({ data }) => setV(((data as V[] | null) ?? [])[0] ?? null));
  }, [code]);
  const send = async () => {
    if (!rating) return setErr('Pick a number from 1 to 5.');
    setBusy(true); setErr('');
    const { error } = await sb.rpc('coach_open_survey_answer', { p_code: code, p_rating: rating, p_comment: comment || null, p_name: name || null });
    setBusy(false);
    if (error) setErr(/try_later/.test(error.message) ? 'Too many answers today. Please try again tomorrow.' : 'Couldn’t send that. Check your connection and try again.'); else setDone(true);
  };
  return (
    <LinkPage title="Quick question">
      {v === undefined ? <ActivityIndicator color={p.ink} /> : v === null ? <Txt>This survey link isn’t active any more.</Txt> : done ? (
        <><Txt>Thank you{v.client_first ? `, ${v.client_first}` : name ? `, ${name}` : ''}! {v.trainer_name} will see your answer.</Txt><ReviewSites surveyCode={code} text={comment} /></>
      ) : (
        <>
          <Txt v="h2">{v.client_first ? `Hi ${v.client_first}` : `A quick question from ${v.trainer_name}`}</Txt>
          <Txt>{v.question} 1 is poor, 5 is great.</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => <Chip key={n} label={String(n)} selected={rating === n} onPress={() => setRating(n)} />)}
          </View>
          <Field label="Anything you’d like to add? (optional)" value={comment} onChangeText={setComment} multiline maxLength={1000} />
          {!v.client_first && <Field label="Your first name (optional)" value={name} onChangeText={setName} maxLength={60} />}
          <Txt v="small">Please don’t include health details here.</Txt>
          {err ? <Txt color={p.danger}>{err}</Txt> : null}
          <Button title="Send" busy={busy} onPress={send} />
        </>
      )}
    </LinkPage>
  );
}
