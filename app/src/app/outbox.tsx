// "To send": messages waiting for the trainer to send from their phone, and replies that need an answer.
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { Button, Card, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { contactLink } from '@/lib/contact';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

type Msg = { id: string; client_id: string; kind: string; body: string; send_after: string; coach_clients: { name: string; phone: string | null } | null };
type Reply = { id: string; client_id: string | null; body: string; parsed: { kind?: string }; received_at: string; coach_clients: { name: string } | null };
const KIND: Record<string, string> = { reminder: 'Reminder', slot_offer: 'Open slot', survey: 'Survey', testimonial_ask: 'Testimonial', referral_ask: 'Referral', group_invite: 'Group invite', note: 'Message' };

export default function Outbox() {
  const p = usePalette();
  const app = useApp();
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const load = useCallback(async () => {
    const [m, r] = await Promise.all([
      sb.from('coach_outbox').select('id, client_id, kind, body, send_after, coach_clients(name, phone)').eq('status', 'queued').eq('channel', 'manual')
        .lte('send_after', new Date(Date.now() + 3600_000).toISOString()).order('send_after').limit(100),
      sb.from('coach_inbox').select('id, client_id, body, parsed, received_at, coach_clients(name)').eq('handled', false).order('received_at', { ascending: false }).limit(50),
    ]);
    if (m.error) toast(errText(m.error), false);
    setMsgs((m.data as unknown as Msg[]) ?? []); setReplies((r.data as unknown as Reply[]) ?? []);
  }, [toast]);
  useFocusEffect(useCallback(() => { if (app.trainer) void load(); }, [load, app.trainer]));
  const send = async (m: Msg) => {
    const link = contactLink('sms', m.coach_clients?.phone, m.body, Platform.OS);
    if (!link) return toast('No mobile number saved for this client', false);
    await Linking.openURL(link);
    const { error } = await sb.from('coach_outbox').update({ status: 'sent' }).eq('id', m.id);
    if (error) toast(errText(error), false); else void load();
  };
  const skip = async (m: Msg) => {
    const { error } = await sb.from('coach_outbox').update({ status: 'cancelled' }).eq('id', m.id);
    if (error) toast(errText(error), false); else void load();
  };
  const handled = async (r: Reply) => {
    const { error } = await sb.from('coach_inbox').update({ handled: true }).eq('id', r.id);
    if (error) toast(errText(error), false); else void load();
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
      <Stack.Screen options={{ title: 'To send' }} />
      <View style={{ width: '100%', maxWidth: MAX_W, gap: 10 }}>
        {replies.length > 0 && <Txt v="kicker" color={p.focus}>Replies to answer</Txt>}
        {replies.map((r) => (
          <Card key={r.id} style={{ gap: 4 }}>
            <Txt v="bold">{r.coach_clients?.name ?? 'Unknown number'} · {new Date(r.received_at).toLocaleString()}</Txt>
            <Txt>“{r.body}”</Txt>
            {r.parsed.kind === 'reschedule' && <Txt v="small">Asked to reschedule.</Txt>}
            <Button small kind="ghost" title="Done" onPress={() => handled(r)} style={{ alignSelf: 'flex-start' }} />
          </Card>
        ))}
        <Txt v="kicker" color={p.focus}>Texts to send from your phone</Txt>
        {msgs === null ? <Txt>Loading…</Txt> : msgs.length === 0 ? <Txt v="small">Nothing waiting. Reminders for clients without the app show up here when they’re due.</Txt> : msgs.map((m) => (
          <Card key={m.id} style={{ gap: 6 }}>
            <Txt v="bold">{KIND[m.kind] ?? 'Message'} · {m.coach_clients?.name ?? 'Client'}</Txt>
            <Txt>{m.body}</Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small icon="sms" title="Text it" onPress={() => send(m)} />
              <Button small kind="ghost" title="Skip" onPress={() => skip(m)} />
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
