// The link in a slot-offer text: shows the open time and lets the client take it (no sign-in needed).
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ambient } from '@/components/ambient';
import { Button, Card, Txt } from '@/components/ui';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type Offer = { starts_at: string; duration_min: number; title: string; location: string | null; trainer_name: string; client_first: string; state: string };
const STATE_TEXT: Record<string, string> = {
  yours: 'It’s yours! The session is on your calendar. See you then.',
  filled: 'Sorry, someone else took this one. We’ll let you know about the next opening.',
  expired: 'This offer has closed.',
  withdrawn: 'Your trainer withdrew this offer.',
  declined: 'No problem, you passed on this one.',
};

export default function SlotOffer() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [offer, setOffer] = useState<Offer | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = () => sb.rpc('coach_slot_offer_view', { p_token: token }).then(({ data }) => setOffer(((data as Offer[] | null) ?? [])[0] ?? null));
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const answer = async (accept: boolean) => {
    setBusy(true); setErr('');
    const { error } = await sb.rpc('coach_answer_slot_offer', { p_token: token, p_accept: accept });
    setBusy(false);
    if (error) setErr('Couldn’t save your answer. Check your connection and try again.'); else void load();
  };
  const when = offer ? new Date(offer.starts_at).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ headerShown: false, title: 'Open training slot' }} />
      <Ambient />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 40, alignItems: 'center' }}>
        <Card style={{ width: '100%', maxWidth: 440, gap: 12 }}>
          {offer === undefined ? <ActivityIndicator color={p.ink} /> : offer === null ? (
            <Txt>This link isn’t valid. Ask your trainer to send it again.</Txt>
          ) : (
            <>
              <Txt v="h2">Hi {offer.client_first}</Txt>
              <Txt>{offer.trainer_name} has an open spot:</Txt>
              <Txt v="bold">{offer.title} · {when} · {offer.duration_min} min{offer.location ? ` · ${offer.location}` : ''}</Txt>
              {offer.state === 'open' ? (
                <>
                  <Txt v="small">First to grab it gets it.</Txt>
                  <Button title="I’ll take it" busy={busy} onPress={() => answer(true)} />
                  <Button kind="ghost" title="Not this time" disabled={busy} onPress={() => answer(false)} />
                </>
              ) : <Txt>{STATE_TEXT[offer.state] ?? ''}</Txt>}
              {err ? <Txt color={p.danger}>{err}</Txt> : null}
            </>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
