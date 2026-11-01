import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Badge, Screen } from '@/components/shell';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { errText, type Client, type ClientStatus } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

const STATUS_LABEL: Record<ClientStatus, string> = { invited: 'Invited', active: 'Active', paused: 'Paused', archived: 'Archived' };

/** Trainer home: the client roster. */
export default function Coach() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [show, setShow] = useState<'current' | 'archived'>('current');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!app.trainer) return;
    const { data, error } = await sb.from('coach_clients').select('*').eq('trainer_id', app.trainer.user_id).order('name');
    if (error) toast(errText(error), false);
    setClients((data as Client[]) ?? []);
  }, [app.trainer, toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!app.user) return <Redirect href="/welcome" />;
  if (!app.trainer) return <Redirect href="/" />;

  const add = async () => {
    if (!name.trim()) return toast('Enter the client’s name', false);
    setBusy(true);
    try {
      const { data, error } = await sb.from('coach_clients')
        .insert({ trainer_id: app.trainer!.user_id, name: name.trim(), email: email.trim() || null, status: 'invited' })
        .select('id').single();
      if (error) throw error;
      setName(''); setEmail(''); setAdding(false);
      router.push({ pathname: '/coach/client/[id]', params: { id: data.id, invite: '1' } });
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };

  const list = (clients ?? []).filter((c) => (show === 'archived' ? c.status === 'archived' : c.status !== 'archived'));
  const counts = { active: (clients ?? []).filter((c) => c.status === 'active').length, invited: (clients ?? []).filter((c) => c.status === 'invited').length };

  return (
    <Screen kicker={app.trainer.business_name ?? 'Coaching'} title="Clients"
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}
      right={!adding && <Button title="Add client" icon="person_add" onPress={() => setAdding(true)} />}>
      {adding && (
        <Card style={{ marginBottom: 16 }}>
          <Txt v="h3" style={{ marginBottom: 12 }}>New client</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14 }}>
            <View style={{ flexGrow: 1, flexBasis: 240 }}><Field label="Name" value={name} onChangeText={setName} autoFocus autoComplete="off" /></View>
            <View style={{ flexGrow: 1, flexBasis: 240 }}><Field label="Email" hint="(optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="off" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Add and invite" busy={busy} onPress={add} />
            <Button kind="ghost" title="Cancel" onPress={() => setAdding(false)} />
          </View>
        </Card>
      )}

      {clients === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 40 }} /> : clients.length === 0 ? (
        <Empty emoji="🪽" title="Add your first client" body="Add a client, send them the invite link, and they’ll see everything you assign in their app."
          action={!adding && <Button title="Add client" icon="person_add" onPress={() => setAdding(true)} />} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label={`Current (${counts.active + counts.invited + (clients ?? []).filter((c) => c.status === 'paused').length})`} selected={show === 'current'} onPress={() => setShow('current')} />
            <Chip label="Archived" selected={show === 'archived'} onPress={() => setShow('archived')} />
            {counts.invited > 0 && <Txt v="small" style={{ marginLeft: 4 }}>{counts.invited} waiting to accept their invite</Txt>}
          </View>
          <Card style={{ padding: 0 }}>
            {list.length === 0 && <Txt v="small" style={{ padding: 16 }}>No archived clients.</Txt>}
            {list.map((c, i) => (
              <Pressable key={c.id} accessibilityRole="link" accessibilityLabel={`${c.name}, ${STATUS_LABEL[c.status]}`}
                onPress={() => router.push({ pathname: '/coach/client/[id]', params: { id: c.id } })}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.soft, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt v="h3">{c.name.charAt(0).toUpperCase()}</Txt>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="bold">{c.name}</Txt>
                  {c.goals ? <Txt v="small" numberOfLines={1}>{c.goals}</Txt> : c.email ? <Txt v="small" numberOfLines={1}>{c.email}</Txt> : null}
                </View>
                <Badge text={STATUS_LABEL[c.status]} color={c.status === 'active' ? p.good : c.status === 'invited' ? p.gold : p.muted} />
                <Icon name="chevron_right" size={20} color={p.muted} />
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
