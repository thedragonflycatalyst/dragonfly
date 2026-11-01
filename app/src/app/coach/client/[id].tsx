import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Share, View } from 'react-native';
import { Badge } from '@/components/shell';
import { Button, Card, Empty, Field, Txt, useToast } from '@/components/ui';
import { ask } from '@/lib/ask';
import { errText, type Client, type ClientStatus } from '@/lib/model';
import { inviteLink, sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

/** One client: invite, status, goals and private notes. Workouts and progress arrive in Phase 1–2. */
export default function ClientScreen() {
  const p = usePalette();
  const toast = useToast();
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const [c, setC] = useState<Client | null | undefined>(undefined);
  const [code, setCode] = useState<string | null>(null);
  const [goals, setGoals] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cl, n, inv] = await Promise.all([
      sb.from('coach_clients').select('*').eq('id', id).maybeSingle(),
      sb.from('coach_client_notes').select('notes').eq('client_id', id).maybeSingle(),
      sb.from('coach_invites').select('code').eq('client_id', id).is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle(),
    ]);
    const row = (cl.data as Client) ?? null;
    setC(row); setGoals(row?.goals ?? ''); setNotes(n.data?.notes ?? ''); setCode(inv.data?.code ?? null);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const makeInvite = useCallback(async () => {
    setBusy('invite');
    try {
      const { data, error } = await sb.rpc('coach_create_invite', { p_client: id });
      if (error) throw error;
      setCode(data as string);
    } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  }, [id, toast]);
  // Coming straight from "Add and invite": make the code right away
  useEffect(() => { if (invite && c && c.status === 'invited' && !code) makeInvite(); }, [invite, c, code, makeInvite]);

  if (c === undefined) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!c) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔎" title="Client not found" /></View>;

  const run = async (key: string, fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setBusy(key);
    try { const { error } = await fn(); if (error) throw error; toast(ok); await load(); } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };
  const setStatus = (s: ClientStatus, ok: string) => run(s, () => sb.from('coach_clients').update({ status: s }).eq('id', c.id), ok);
  const link = code ? inviteLink(code) : '';
  const message = `Hi ${c.name.split(' ')[0]}! Here’s your invite to Dragonfly Coach, where you’ll find your workouts and check-ins: ${link} (code ${code})`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: c.name }} />
      <View style={{ width: '100%', maxWidth: MAX_W, gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Txt v="h1">{c.name}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge text={c.status[0].toUpperCase() + c.status.slice(1)} color={c.status === 'active' ? p.good : c.status === 'invited' ? p.gold : p.muted} />
            {c.email ? <Txt v="small">{c.email}</Txt> : null}
            {c.started_on ? <Txt v="small">· joined {new Date(`${c.started_on}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Txt> : null}
          </View>
        </View>

        {!c.user_id && (
          <Card style={{ gap: 10 }}>
            <Txt v="h3">Invite {c.name.split(' ')[0]}</Txt>
            <Txt v="small" style={{ fontSize: 15 }}>Send this link. They open it, sign in or create a Dragonfly account, and they’re connected. Codes last 14 days.</Txt>
            {code ? (
              <>
                <Txt selectable style={{ fontSize: 28, letterSpacing: 4, fontFamily: undefined, fontWeight: '700' }} accessibilityLabel={`Invite code ${code.split('').join(' ')}`}>{code}</Txt>
                <Txt v="small" selectable>{link}</Txt>
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  {Platform.OS !== 'web' && <Button title="Send invite" icon="share" onPress={() => Share.share({ message })} />}
                  <Button kind={Platform.OS === 'web' ? 'solid' : 'ghost'} title="Copy message" icon="content_copy" onPress={async () => { await Clipboard.setStringAsync(message); toast('Invite message copied'); }} />
                  <Button kind="quiet" small title="New code" busy={busy === 'invite'} onPress={makeInvite} style={{ alignSelf: 'center' }} />
                </View>
              </>
            ) : (
              <Button title="Create invite link" icon="link" busy={busy === 'invite'} style={{ alignSelf: 'flex-start' }} onPress={makeInvite} />
            )}
          </Card>
        )}

        <Card>
          <Field label="Goals" hint="(your client sees these)" value={goals} onChangeText={setGoals} multiline placeholder="Lose 15 lb, run a 5K in March, pain-free squats" />
          <Field label="Private notes" hint="(only you see these)" value={notes} onChangeText={setNotes} multiline placeholder="Injuries, preferences, schedule…" />
          <Button title="Save" busy={busy === 'save'} style={{ alignSelf: 'flex-start' }} onPress={() => run('save', async () => {
            const a = await sb.from('coach_clients').update({ goals: goals.trim() || null }).eq('id', c.id);
            if (a.error) return a;
            return sb.from('coach_client_notes').upsert({ client_id: c.id, trainer_id: c.trainer_id, notes });
          }, 'Saved')} />
        </Card>

        <Card style={{ gap: 10 }}>
          <Txt v="h3">Workouts and progress</Txt>
          <Txt v="small" style={{ fontSize: 15 }}>Assigning workouts and programs comes next (Phase 1). Check-ins, habits and photos follow in Phase 2.</Txt>
        </Card>

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {c.status === 'active' && <Button kind="ghost" title="Pause client" busy={busy === 'paused'} onPress={() => setStatus('paused', 'Client paused')} />}
          {c.status === 'paused' && <Button kind="ghost" title="Resume client" busy={busy === 'active'} onPress={() => setStatus('active', 'Client active again')} />}
          {c.status !== 'archived' ? (
            <Button kind="danger" title="Archive client" busy={busy === 'archived'} onPress={() => ask('Archive this client?', `${c.name} loses access to their program. Their history is kept and you can restore them anytime.`,
              [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => setStatus('archived', 'Client archived') }])} />
          ) : (
            <Button kind="ghost" title="Restore client" busy={busy === 'active'} onPress={() => setStatus(c.user_id ? 'active' : 'invited', 'Client restored')} />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
