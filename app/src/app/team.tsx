import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Row, SectionLabel } from '@/components/bits';
import { Sheet } from '@/components/sheet';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { errText, isEmail, type TeamMember } from '@/lib/model';
import { inviteTrainer, sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

/** Solo or team: create a team, add trainers, open a trainer's account */
export default function TeamScreen() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [name, setName] = useState(app.ownTrainer?.business_name ?? '');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => { app.reloadTeam(); }, [app.reloadTeam])); // eslint-disable-line react-hooks/exhaustive-deps

  const members = app.teamMembers;
  const open = async (m: TeamMember) => {
    try { await app.startViewing(m); router.replace('/coach'); } catch (e) { toast(errText(e), false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: app.team?.name ?? 'Team' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          {!app.team ? (
            <Card style={{ gap: 10 }}>
              <Txt v="h2">Working solo, or with a team?</Txt>
              <Txt>You’re set up as a solo trainer. Create a team to add trainers: each gets their own account, clients, workouts and meal plans, and shares your food library. You can open any trainer’s account to check on things.</Txt>
              <Field label="Team or business name" value={name} onChangeText={setName} placeholder="The Dragonfly Catalyst" />
              <Button title="Create team" busy={busy} disabled={!name.trim()} style={{ alignSelf: 'flex-start' }} onPress={async () => {
                setBusy(true);
                const { error } = await sb.rpc('coach_team_create', { p_name: name.trim() });
                setBusy(false);
                if (error) return toast(errText(error), false);
                await app.reloadTeam(); toast('Team created. Add your first trainer.');
              }} />
            </Card>
          ) : (
            <>
              {app.isOwner && <Button title="Add a trainer" icon="person_add" style={{ alignSelf: 'flex-start' }} onPress={() => setAdding(true)} />}
              <SectionLabel>Trainers</SectionLabel>
              <Card style={{ padding: 0 }}>
                {members.map((m, i) => (
                  <Row key={m.id} icon={m.role === 'owner' ? 'star' : 'person'} title={m.display_name} last={i === members.length - 1}
                    sub={m.role === 'owner' ? `Owner · ${m.email}` : m.status === 'invited' ? `Invited · ${m.email}${app.isOwner ? ' · tap to resend' : ''}` : m.email}
                    onPress={!app.isOwner || m.role !== 'trainer' ? undefined : m.status === 'active' ? () => open(m)
                      : async () => { try { await inviteTrainer(m.id); toast(`Sent ${m.display_name} the email again`); } catch (e) { toast(errText(e), false); } }}
                    right={app.isOwner && m.role === 'trainer' ? (
                      <Button small kind="quiet" title="Remove" onPress={() => ask(`Remove ${m.display_name} from the team?`, 'They keep their account, clients and library. You just can’t open their account anymore.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: async () => { const { error } = await sb.rpc('coach_team_remove', { p_member: m.id }); if (error) toast(errText(error), false); app.reloadTeam(); } }])} />) : undefined} />
                ))}
              </Card>
              {app.isOwner
                ? <Txt v="small">Tap a trainer to open their account. It opens view only; switch on emergency editing if you need to change something.</Txt>
                : <Txt v="small">You’re on {app.team.name}. Your clients and library are your own; the food library is shared with the team.</Txt>}
            </>
          )}
        </View>
      </ScrollView>
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a trainer">
        <Field label="Name" value={newName} onChangeText={setNewName} placeholder="Alex Rivera" />
        <Field label="Email" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" placeholder="alex@example.com" />
        <Txt v="small" style={{ marginBottom: 12 }}>We email them a code to set their password, just like clients. If they already have a Dragonfly account, they join when they next sign in.</Txt>
        <Button title="Add and send invite" busy={busy} disabled={!newName.trim() || !isEmail(newEmail)} style={{ alignSelf: 'flex-start' }} onPress={async () => {
          setBusy(true);
          const { data, error } = await sb.rpc('coach_team_add', { p_email: newEmail.trim(), p_name: newName.trim() });
          if (error) { setBusy(false); return toast(errText(error), false); }
          try {
            const r = await inviteTrainer(data as string);
            toast(r === 'existing' ? `${newName.trim()} already has a Dragonfly account. They’ll join when they sign in.` : `Invite emailed to ${newName.trim()}`);
          } catch (e) { toast(errText(e), false); }
          setBusy(false); setAdding(false); setNewName(''); setNewEmail(''); app.reloadTeam();
        }} />
      </Sheet>
    </View>
  );
}
