import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { Button, Card, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import {
  changeEmail, changePassword, confirmWithCode, currentSessionId, deleteAccount, exportData, listSessions, removeAvatar,
  resendVerification, revokeSession, setUsername, uploadAvatar, type DeviceSession,
} from '@/lib/account';
import { ask } from '@/lib/ask';
import { useApp } from '@/lib/app-state';
import { fmtShort, fmtTime } from '@/lib/dates';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type Open = null | 'email' | 'emailcode' | 'password' | 'username' | 'devices' | 'delete';

export default function Account() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [f, setF] = useState({ current: '', next: '', confirm: '', email: '', username: '', del: '', code: '' });
  const [pendingEmail, setPendingEmail] = useState('');
  const [devices, setDevices] = useState<DeviceSession[] | null>(null);
  const [mySession, setMySession] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const email = app.user?.email ?? '';
  const verified = !!app.user?.email_confirmed_at;
  const hasUsername = !!app.username && !app.username.includes('@');

  if (!app.user) {
    return <View style={{ flex: 1, backgroundColor: p.bg, padding: 16 }}><Empty emoji="🔐" title="Sign in to manage your account" action={<Button title="Sign in" onPress={() => router.replace('/sign-in')} />} /></View>;
  }
  const run = async (key: string, fn: () => Promise<unknown>, ok: string, after?: () => void) => {
    setBusy(key);
    try { await fn(); toast(ok); after?.(); } catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };
  const toggle = (k: Open) => { setOpen(open === k ? null : k); setF({ current: '', next: '', confirm: '', email: '', username: '', del: '', code: '' }); };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast('Allow photo access in Settings to choose a picture', false);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    run('photo', async () => { await uploadAvatar(app.user!.id, a.uri, a.width, a.height); await app.refreshAvatar(); }, 'Profile picture updated in all Dragonfly apps');
  };
  const photoMenu = () => (Platform.OS === 'web' && !app.avatar) ? pickPhoto() : ask('Profile picture', 'Your picture shows in every Dragonfly app.', [
    { text: 'Choose a photo', onPress: pickPhoto },
    ...(app.avatar ? [{ text: 'Remove picture', style: 'destructive' as const, onPress: () => run('photo', async () => { await removeAvatar(app.user!.id); await app.refreshAvatar(); }, 'Picture removed') }] : []),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
  const loadDevices = async () => {
    setBusy('devices');
    try { const [list, mine] = await Promise.all([listSessions(), currentSessionId()]); setDevices(list); setMySession(mine); }
    catch (e) { toast(errText(e), false); } finally { setBusy(null); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <Pressable onPress={photoMenu} accessibilityRole="button" accessibilityLabel="Change profile picture">
          <Avatar size={112} />
          <View style={{ position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: p.surface, borderWidth: 2, borderColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
            {busy === 'photo' ? <ActivityIndicator color={p.ink} /> : <Icon name="photo_camera" size={18} />}
          </View>
        </Pressable>
        <Txt v="h1" style={{ marginTop: 12 }}>{hasUsername ? app.username : 'Your account'}</Txt>
        <Txt v="small" style={{ fontSize: 15 }}>{email}</Txt>
        <Txt v="small" center style={{ marginTop: 6 }}>One Dragonfly account for every Dragonfly app. Changes here apply everywhere.</Txt>
        <Txt v="small" center style={{ marginTop: 2 }}>Dragonfly Coach version {Constants.expoConfig?.version ?? 'dev'}</Txt>
      </View>

      {!verified && (
        <Card style={{ marginTop: 10 }}>
          <Txt v="bold">Your email isn’t confirmed yet</Txt>
          <Txt v="small" style={{ marginVertical: 6 }}>Open the link we sent to {email}.</Txt>
          <Button small kind="quiet" title="Send it again" busy={busy === 'resend'} style={{ alignSelf: 'flex-start' }}
            onPress={() => run('resend', () => resendVerification(email), 'Confirmation email sent')} />
        </Card>
      )}

      <Card style={{ marginTop: 14, padding: 0 }}>
        {!hasUsername && <Row icon="person" title="Choose a username" onPress={() => toggle('username')} open={open === 'username'} />}
        {open === 'username' && (
          <Panel>
            <Field label="Username" hint="(no spaces, can’t be changed later)" value={f.username} onChangeText={(t) => set('username')(t.replace(/\s+/g, ''))} autoCapitalize="none" autoCorrect={false} />
            <Button title="Save username" busy={busy === 'username'} onPress={() => run('username', () => setUsername(f.username), 'Username saved', () => { app.reloadMe(); setOpen(null); })} />
          </Panel>
        )}
        <Row icon="mail" title="Change email" sub={email} onPress={() => toggle('email')} open={open === 'email'} />
        {open === 'email' && (
          <Panel>
            <Field label="New email" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Field label="Current password" value={f.current} onChangeText={set('current')} secureTextEntry autoComplete="current-password" />
            <Button title="Change email" busy={busy === 'email'} onPress={() => run('email', () => changeEmail(email, f.current, f.email.trim()), 'We emailed a code to your new address', () => { setPendingEmail(f.email.trim()); setOpen('emailcode'); setF((x) => ({ ...x, code: '' })); })} />
          </Panel>
        )}
        {open === 'emailcode' && (
          <Panel>
            <Txt v="small" style={{ marginBottom: 10 }}>Enter the code sent to {pendingEmail}. If your old address also gets an email, confirm that one too.</Txt>
            <Field label="Code from the email" value={f.code} onChangeText={set('code')} keyboardType="number-pad" autoComplete="one-time-code" />
            <Button title="Confirm new email" busy={busy === 'emailcode'} onPress={() => run('emailcode', () => confirmWithCode(pendingEmail, f.code, 'email_change'), 'Email updated for all Dragonfly apps', () => { setOpen(null); app.reloadMe(); })} />
          </Panel>
        )}
        <Row icon="key" title="Change password" onPress={() => toggle('password')} open={open === 'password'} />
        {open === 'password' && (
          <Panel>
            <Field label="Current password" value={f.current} onChangeText={set('current')} secureTextEntry autoComplete="current-password" />
            <Field label="New password" hint="(8+ characters)" value={f.next} onChangeText={set('next')} secureTextEntry autoComplete="new-password" />
            <Field label="Confirm new password" value={f.confirm} onChangeText={set('confirm')} secureTextEntry autoComplete="new-password" />
            <Button title="Change password" busy={busy === 'password'} onPress={() => f.next !== f.confirm ? toast('The new passwords don’t match', false)
              : run('password', () => changePassword(email, f.current, f.next), 'Password changed for all Dragonfly apps', () => setOpen(null))} />
          </Panel>
        )}
        <Row icon="devices" title="Signed-in devices" sub="See where you’re signed in" onPress={() => { toggle('devices'); if (open !== 'devices') loadDevices(); }} open={open === 'devices'} last={open !== 'devices'} />
        {open === 'devices' && (
          <Panel last>
            {busy === 'devices' && !devices ? <ActivityIndicator color={p.ink} /> : devices?.map((d) => (
              <View key={d.session_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                <View style={{ flex: 1 }}>
                  <Txt v="bold">{d.session_id === mySession ? 'This device' : `Device ${d.session_id.slice(0, 6)}`}</Txt>
                  <Txt v="small">Signed in {fmtShort(d.created_at)} · active {fmtShort(d.updated_at)} {fmtTime(d.updated_at)}</Txt>
                </View>
                {d.session_id !== mySession && <Button small kind="quiet" title="Sign out" onPress={() => run('rev', () => revokeSession(d.session_id), 'Device signed out', loadDevices)} />}
              </View>
            ))}
            <Button small kind="ghost" title="Sign out all other devices" style={{ marginTop: 8, alignSelf: 'flex-start' }}
              onPress={() => ask('Sign out other devices?', 'You’ll stay signed in here.', [{ text: 'Cancel', style: 'cancel' },
                { text: 'Sign out others', onPress: () => run('others', async () => { const { error } = await sb.auth.signOut({ scope: 'others' }); if (error) throw error; }, 'Other devices signed out', loadDevices) }])} />
          </Panel>
        )}
      </Card>

      <Card style={{ marginTop: 14, padding: 0 }}>
        <Row icon="download" title="Export my account data" busy={busy === 'export'} onPress={() => run('export', async () => {
          const data = await exportData(); const json = JSON.stringify(data, null, 2);
          if (Platform.OS === 'web') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'dragonfly-account.json'; a.click(); }
          else await Share.share({ title: 'My Dragonfly account data', message: json });
        }, 'Export ready')} />
        <Row icon="logout" title="Sign out" last onPress={() => run('out', app.signOut, 'Signed out', () => router.replace('/'))} />
      </Card>

      <Card style={{ marginTop: 14, padding: 0 }}>
        <Row icon="delete" title="Delete account" danger onPress={() => toggle('delete')} open={open === 'delete'} last={open !== 'delete'} />
        {open === 'delete' && (
          <Panel last>
            <Txt v="small" style={{ marginBottom: 12 }}>This permanently deletes your Dragonfly account for every Dragonfly app, including the Uploader. It can’t be undone.</Txt>
            <Field label="Current password" value={f.current} onChangeText={set('current')} secureTextEntry />
            <Field label="Type DELETE MY ACCOUNT" value={f.del} onChangeText={set('del')} autoCapitalize="characters" autoCorrect={false} />
            <Button kind="danger" title="Permanently delete account" busy={busy === 'delete'} disabled={f.del !== 'DELETE MY ACCOUNT' || !f.current}
              onPress={() => run('delete', async () => { await deleteAccount(f.current, f.del); await app.signOut(); }, 'Account deleted', () => router.replace('/'))} />
          </Panel>
        )}
      </Card>
    </ScrollView>
  );
}

function Row({ icon, title, sub, onPress, open, last, danger, busy }: {
  icon: Parameters<typeof Icon>[0]['name']; title: string; sub?: string; onPress: () => void; open?: boolean; last?: boolean; danger?: boolean; busy?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.7 : 1 })}>
      <Icon name={icon} color={danger ? p.danger : p.ink} />
      <View style={{ flex: 1 }}>
        <Txt v="bold" color={danger ? p.danger : p.ink}>{title}</Txt>
        {sub ? <Txt v="small" numberOfLines={1}>{sub}</Txt> : null}
      </View>
      {busy ? <ActivityIndicator color={p.ink} /> : <Icon name={open ? 'expand_less' : 'chevron_right'} size={20} color={p.muted} />}
    </Pressable>
  );
}
function Panel({ children, last }: { children: React.ReactNode; last?: boolean }) {
  const p = usePalette();
  return <View style={{ padding: 16, paddingTop: 4, borderBottomWidth: last ? 0 : 1, borderBottomColor: p.line }}>{children}</View>;
}
