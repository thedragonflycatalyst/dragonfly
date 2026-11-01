import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { ComingWith, Initials, Row, SectionLabel, statusColor } from '@/components/bits';
import { Badge } from '@/components/shell';
import { Button, Card, Empty, Txt, useToast } from '@/components/ui';
import { SECTIONS, useClientRecord, type SectionKey } from '@/features/common';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { fmtShort } from '@/lib/dates';
import { removeStored } from '@/lib/files';
import { errText, STATUS_LABEL, type ClientStatus } from '@/lib/model';
import { inviteClient, INVITE_MESSAGE, sb } from '@/lib/supabase';
import { age, fmtHeight, fmtWeight } from '@/lib/units';
import { MAX_W, usePalette } from '@/lib/theme';

type Summary = { weight: number | null; photos: number; files: number; pendingForms: number; flagged: boolean; habits: number; notes: number; groups: string[] };

// Sections that arrive with later tabs, so they're listed but not open yet
const LATER: { title: string; icon: Parameters<typeof Row>[0]['icon']; with: string }[] = [
  { title: 'Nutrition plans', icon: 'restaurant', with: 'the Nutrition tab' },
  { title: 'Sessions', icon: 'event', with: 'the Hub and your schedule' },
  { title: 'Credits', icon: 'payments', with: 'payments' },
  { title: 'Check-ins', icon: 'inbox', with: 'the Hub' },
  { title: 'Watch and app data', icon: 'watch', with: 'watch pairing' },
  { title: 'Communities', icon: 'groups', with: 'the Hub' },
];

/** One client, from the trainer's side: who they are, every section of their profile, and account actions. */
export default function ClientProfile() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client: c, reload } = useClientRecord(id);
  const [s, setS] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!id) return;
    const [m, ph, fi, fo, ha, no, gr] = await Promise.all([
      sb.from('coach_measurements').select('weight_kg').eq('client_id', id).not('weight_kg', 'is', null).order('measured_on', { ascending: false }).order('created_at', { ascending: false }).limit(1),
      sb.from('coach_photos').select('id', { count: 'exact', head: true }).eq('client_id', id),
      sb.from('coach_files').select('id', { count: 'exact', head: true }).eq('client_id', id),
      sb.from('coach_form_requests').select('status,flagged').eq('client_id', id),
      sb.from('coach_habits').select('id', { count: 'exact', head: true }).eq('client_id', id).eq('active', true),
      sb.from('coach_notes').select('id', { count: 'exact', head: true }).eq('client_id', id),
      sb.from('coach_group_members').select('coach_groups(name)').eq('client_id', id),
    ]);
    setS({
      weight: m.data?.[0]?.weight_kg ?? null, photos: ph.count ?? 0, files: fi.count ?? 0,
      pendingForms: (fo.data ?? []).filter((r) => r.status === 'pending').length, flagged: (fo.data ?? []).some((r) => r.flagged),
      habits: ha.count ?? 0, notes: no.count ?? 0,
      groups: (gr.data ?? []).map((r) => (r as unknown as { coach_groups: { name: string } | null }).coach_groups?.name).filter(Boolean) as string[],
    });
  }, [id]);
  useFocusEffect(useCallback(() => { reload(); loadSummary(); }, [reload, loadSummary]));

  if (c === undefined) return <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}><ActivityIndicator color={p.ink} /></View>;
  if (!c) return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔎" title="Client not found" /></View>;

  const first = c.first_name;
  const setStatus = async (status: ClientStatus, ok: string) => {
    setBusy(status);
    try {
      const { error } = await sb.from('coach_clients').update({ status }).eq('id', c.id);
      if (error) throw error;
      toast(ok); await reload();
    } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };
  const invite = async () => {
    setBusy('invite');
    try {
      if (c.status === 'lead') { const { error } = await sb.from('coach_clients').update({ status: 'invited' }).eq('id', c.id); if (error) throw error; }
      toast(INVITE_MESSAGE[await inviteClient(c.id)](first)); await reload();
    } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };
  const remove = () => ask(`Delete ${c.name}?`, 'This permanently deletes their profile, measurements, photos, files, forms, habits and notes. Their Dragonfly account itself isn’t deleted. This can’t be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete permanently', style: 'destructive', onPress: async () => {
      setBusy('delete');
      try {
        const [ph, fi] = await Promise.all([sb.from('coach_photos').select('path').eq('client_id', c.id), sb.from('coach_files').select('path').eq('client_id', c.id)]);
        await removeStored([...(ph.data ?? []), ...(fi.data ?? [])].map((r) => r.path));
        const { error } = await sb.from('coach_clients').delete().eq('id', c.id);
        if (error) throw error;
        toast(`${c.name} deleted`); router.back();
      } catch (e) { toast(errText(e), false); setBusy(null); }
    } },
  ]);

  const facts = [
    c.date_of_birth ? `${age(c.date_of_birth)} years old` : null,
    c.sex ? c.sex[0].toUpperCase() + c.sex.slice(1) : null,
    c.height_cm ? fmtHeight(c.height_cm, app.units) : null,
    s?.weight ? fmtWeight(s.weight, app.units) : null,
  ].filter(Boolean).join(' · ');
  const subFor = (k: SectionKey): string | null => {
    if (!s) return null;
    switch (k) {
      case 'measurements': return s.weight ? `Latest ${fmtWeight(s.weight, app.units)}` : 'None yet';
      case 'photos': return s.photos ? `${s.photos} photos` : 'None yet';
      case 'files': return s.files ? `${s.files} files` : 'None yet';
      case 'forms': return s.flagged ? 'Health questionnaire flagged: review it' : s.pendingForms ? `${s.pendingForms} waiting for ${first}` : 'All answered';
      case 'habits': return s.habits ? `${s.habits} active` : 'None yet';
      case 'notes': return s.notes ? `${s.notes} notes, only you see these` : 'Only you see these';
      case 'goals': return c.goals || (c.interests.length ? c.interests.join(', ') : 'Not set yet');
      case 'activity': return 'Everything they’ve logged, newest first';
    }
  };
  const open = (k: SectionKey) => router.push({ pathname: '/clients/[id]/[section]', params: { id: c.id, section: k } });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
      <Stack.Screen options={{ title: c.name }} />
      <View style={{ width: '100%', maxWidth: MAX_W }}>
        <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
          <Initials name={c.name} size={88} />
          <Txt v="h1" center>{c.name}</Txt>
          <Txt v="small" selectable center>{[c.email, c.phone].filter(Boolean).join(' · ')}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Badge text={STATUS_LABEL[c.status]} color={statusColor(c.status, p)} />
            {s?.groups.map((g) => <Badge key={g} text={g} />)}
          </View>
          {facts ? <Txt v="small" center>{facts}</Txt> : null}
          {c.status === 'frozen' && <Txt v="small" center color={p.focus}>Frozen {c.frozen_at ? fmtShort(c.frozen_at) : ''}{c.frozen_reason === 'inactive' ? ' after no sessions' : ''}. {first} can’t see their training until you unfreeze them.</Txt>}
          {(c.status === 'invited' || c.status === 'lead') && <Txt v="small" center>{c.status === 'lead' ? 'In your client pool. Not invited yet.' : `${first} hasn’t signed in yet.`}</Txt>}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
          <Button kind="quiet" small icon="edit" title="Edit details" onPress={() => router.push({ pathname: '/clients/[id]/edit', params: { id: c.id } })} />
          {(c.status === 'invited' || c.status === 'lead') && <Button small icon="mail" title={c.status === 'lead' ? 'Invite now' : 'Resend email'} busy={busy === 'invite'} onPress={invite} />}
          {c.status === 'active' && <Button kind="quiet" small icon="ac_unit" title="Freeze" busy={busy === 'frozen'} onPress={() => ask(`Freeze ${first}?`,
            `${first} keeps their history but can’t see their training or log anything until you unfreeze them.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Freeze', onPress: () => setStatus('frozen', `${first} is frozen`) }])} />}
          {c.status === 'frozen' && <Button small icon="ac_unit" title="Unfreeze" busy={busy === 'active'} onPress={() => setStatus('active', `${first} is active again`)} />}
        </View>

        {s?.flagged && (
          <Card style={{ marginTop: 16, borderWidth: 1.5, borderColor: p.danger, gap: 6 }}>
            <Txt v="bold" color={p.danger}>Health questionnaire flagged</Txt>
            <Txt v="small" style={{ fontSize: 15 }}>{first} answered yes to at least one question. Review their answers before training, and have them check with their doctor if needed.</Txt>
            <Button small kind="ghost" title="Review answers" style={{ alignSelf: 'flex-start' }} onPress={() => open('forms')} />
          </Card>
        )}

        <SectionLabel>Progress</SectionLabel>
        <Card style={{ padding: 0 }}>
          {(['activity', 'measurements', 'photos', 'habits'] as SectionKey[]).map((k, i, a) => (
            <Row key={k} icon={SECTIONS[k].icon} title={SECTIONS[k].title} sub={subFor(k)} last={i === a.length - 1} onPress={() => open(k)} />
          ))}
        </Card>

        <SectionLabel>Profile</SectionLabel>
        <Card style={{ padding: 0 }}>
          {(['goals', 'forms', 'files', 'notes'] as SectionKey[]).map((k, i, a) => (
            <Row key={k} icon={SECTIONS[k].icon} title={k === 'forms' ? 'Forms and health questionnaire' : SECTIONS[k].title} sub={subFor(k)} last={i === a.length - 1} onPress={() => open(k)} />
          ))}
        </Card>

        <SectionLabel>Training and business</SectionLabel>
        <Card style={{ padding: 0 }}>
          <Row icon="fitness_center" title="Workouts and programs" sub="Calendar, history and assigning" onPress={() => router.push({ pathname: '/clients/[id]/workouts', params: { id: c.id } })} />
          {LATER.map((l, i) => <Row key={l.title} icon={l.icon} title={l.title} disabled last={i === LATER.length - 1} right={<ComingWith what={l.with} />} />)}
          <Row icon="chat_bubble" title={`Message ${first}`} disabled last right={<ComingWith what="the Hub" />} />
        </Card>

        <SectionLabel>Account</SectionLabel>
        <Card style={{ padding: 0 }}>
          {c.status !== 'archived'
            ? <Row icon="archive" title="Archive" sub="Hide from your list and remove their access. Everything is kept." busy={busy === 'archived'}
                onPress={() => ask(`Archive ${first}?`, 'They lose access, and everything is kept. You can restore them anytime.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', onPress: () => setStatus('archived', `${first} archived`) }])} />
            : <Row icon="archive" title="Restore" sub="Back to your client list" busy={busy === 'active' || busy === 'invited'}
                onPress={() => setStatus(c.user_id ? 'active' : 'invited', `${first} restored`)} />}
          <Row icon="delete" title="Delete permanently" danger last busy={busy === 'delete'} onPress={remove} />
        </Card>
      </View>
    </ScrollView>
  );
}
