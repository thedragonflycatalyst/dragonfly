// One reschedule request, opened from the trainer's phone alert or text: who, from when, to when, Approve / Decline.
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { callFn } from '@/lib/fn';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

type Req = { id: string; status: string; old_start: string; new_start: string; reason: string | null; coach_clients: { name: string } | null };
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const DONE: Record<string, string> = { approved: 'Approved: the session was moved.', declined: 'Declined: the session stayed where it was.', expired: 'This request expired: the session started before it was answered.', withdrawn: 'The client took this request back.' };

export default function RescheduleRequest() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [r, setR] = useState<Req | null | undefined>(undefined);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await sb.from('coach_reschedule_requests').select('id, status, old_start, new_start, reason, coach_clients(name)').eq('id', id).maybeSingle();
    setR((data as unknown as Req | null) ?? null);
  }, [id]);
  useEffect(() => { if (app.user) void load(); }, [app.user, load]);
  if (!app.user) return <Redirect href="/sign-in" />;

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { error } = await sb.rpc('coach_reschedule_decide', { p_request: id, p_approve: approve, p_reason: approve ? null : reason || null });
    setBusy(false);
    if (error) return toast(/slot_taken/.test(error.message) ? 'That time is taken now. Decline it and they can pick another.' : /request_expired/.test(error.message) ? 'Too late: the session or the new time has already started.' : errText(error), false);
    toast(approve ? 'Approved. They’ve been told.' : 'Declined. They’ve been told.');
    void callFn('coach-outbox', { action: 'send_now' }).catch(() => {});
    void load();
  };
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Reschedule request' }} />
      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
        <Card style={{ width: '100%', maxWidth: MAX_W, gap: 10 }}>
          {r === undefined ? <ActivityIndicator color={p.ink} /> : r === null ? <Txt>This request isn’t available (it may belong to another trainer).</Txt> : <>
            <Txt v="h2">{r.coach_clients?.name ?? 'A client'}</Txt>
            <Txt>From <Txt v="bold">{when(r.old_start)}</Txt></Txt>
            <Txt>To <Txt v="bold">{when(r.new_start)}</Txt></Txt>
            {r.status !== 'pending' ? <Txt v="bold" color={r.status === 'approved' ? p.good : p.muted}>{DONE[r.status] ?? r.status}{r.reason ? ` (${r.reason})` : ''}</Txt>
              : declining ? <>
                <Field label="Reason (optional, they’ll see it)" value={reason} onChangeText={setReason} maxLength={200} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button kind="danger" title="Decline" busy={busy} onPress={() => decide(false)} />
                  <Button kind="ghost" title="Back" onPress={() => setDeclining(false)} />
                </View>
              </> : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button icon="check" title="Approve" busy={busy} onPress={() => decide(true)} style={{ flex: 1 }} />
                  <Button kind="ghost" title="Decline" onPress={() => setDeclining(true)} style={{ flex: 1 }} />
                </View>
              )}
            <Button small kind="quiet" title="Open calendar" onPress={() => router.push('/calendar')} style={{ alignSelf: 'flex-start' }} />
          </>}
        </Card>
      </ScrollView>
    </View>
  );
}
