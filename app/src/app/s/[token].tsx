// Survey link: one 1–5 question and an optional comment.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Chip, Field, Txt } from '@/components/ui';
import { LinkPage } from '@/features/link-page';
import { ReviewSites } from '@/features/review-sites';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type V = { trainer_name: string; client_first: string; rating: number | null; comment: string | null };

export default function Survey() {
  const p = usePalette();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [v, setV] = useState<V | null | undefined>(undefined);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    void sb.rpc('coach_survey_view', { p_token: token }).then(({ data }) => {
      const row = ((data as V[] | null) ?? [])[0] ?? null;
      setV(row); if (row) { setRating(row.rating); setComment(row.comment ?? ''); }
    });
  }, [token]);
  const send = async () => {
    if (!rating) return setErr('Pick a number from 1 to 5.');
    setBusy(true); setErr('');
    const { error } = await sb.rpc('coach_survey_answer_link', { p_token: token, p_rating: rating, p_comment: comment || null });
    setBusy(false);
    if (error) setErr('Couldn’t send that. Check your connection and try again.'); else setDone(true);
  };
  return (
    <LinkPage title="Quick question">
      {v === undefined ? <ActivityIndicator color={p.ink} /> : v === null ? <Txt>This link isn’t valid any more.</Txt> : done ? (
        <><Txt>Thank you, {v.client_first}! {v.trainer_name} will see your answer.</Txt><ReviewSites token={token} text={comment} /></>
      ) : (
        <>
          <Txt v="h2">Hi {v.client_first}</Txt>
          <Txt>How is training with {v.trainer_name} going? 1 is poor, 5 is great.</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => <Chip key={n} label={String(n)} selected={rating === n} onPress={() => setRating(n)} />)}
          </View>
          <Field label="Anything you’d like to add? (optional)" value={comment} onChangeText={setComment} multiline maxLength={1000} />
          <Txt v="small">Please don’t include health details here.</Txt>
          {err ? <Txt color={p.danger}>{err}</Txt> : null}
          <Button title="Send" busy={busy} onPress={send} />
        </>
      )}
    </LinkPage>
  );
}
