import { useState } from 'react';
import { Switch, View } from 'react-native';
import { SectionLabel } from '@/components/bits';
import { TimeField, Toggle } from '@/components/pickers';
import { Button, Card, Txt, useToast } from '@/components/ui';
import { startPush } from '@/features/push';
import { Page, useTrainerSave } from '@/features/settings-page';
import { useApp } from '@/lib/app-state';
import { callFn, fnText } from '@/lib/fn';
import { NOTIFY_KEYS, notifyPrefs } from '@/lib/prefs';
import { usePalette } from '@/lib/theme';

/** Notifications: each kind by push and/or email, and quiet hours */
export default function Notifications() {
  const p = usePalette();
  const app = useApp();
  const save = useTrainerSave();
  const [n, setN] = useState(() => notifyPrefs(app.trainer?.notify as never));
  const [busy, setBusy] = useState(false);
  const flip = (k: string, ch: 'push' | 'email', v: boolean) => setN({ ...n, [k]: { ...n[k], [ch]: v } });
  return (
    <Page title="Notifications">
      <Card style={{ padding: 0 }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={{ flex: 1 }} /><Txt v="smallBold" style={{ width: 64, textAlign: 'center' }}>Push</Txt><Txt v="smallBold" style={{ width: 64, textAlign: 'center' }}>Email</Txt>
        </View>
        {NOTIFY_KEYS.map(([k, label, sub], i) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: i === NOTIFY_KEYS.length - 1 ? 0 : 1, borderBottomColor: p.line }}>
            <View style={{ flex: 1 }}><Txt v="bold">{label}</Txt><Txt v="small">{sub}</Txt></View>
            {(['push', 'email'] as const).map((ch) => (
              <View key={ch} style={{ width: 64, alignItems: 'center' }}>
                <Switch value={n[k][ch]} onValueChange={(v) => flip(k, ch, v)} accessibilityLabel={`${label} by ${ch}`} trackColor={{ true: p.focus, false: p.line }} thumbColor={p.surface} />
              </View>
            ))}
          </View>
        ))}
      </Card>
      <SectionLabel>Quiet hours</SectionLabel>
      <Card>
        <Toggle label="Pause push notifications at night" value={!!n.quiet?.on} onChange={(on) => setN({ ...n, quiet: { ...n.quiet!, on } } as typeof n)} />
        {n.quiet?.on && <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1 }}><TimeField label="From" value={n.quiet.from} onChange={(from) => setN({ ...n, quiet: { ...n.quiet!, from } } as typeof n)} /></View>
          <View style={{ flex: 1 }}><TimeField label="Until" value={n.quiet.to} onChange={(to) => setN({ ...n, quiet: { ...n.quiet!, to } } as typeof n)} /></View>
        </View>}
      </Card>
      <Txt v="small">Push notifications reach you through the Dragonfly app on your phone. Until then, everything shows under the bell at the top of your Hub.</Txt>
      <PushTest />
      <Button title="Save" icon="check" busy={busy} style={{ alignSelf: 'center', minWidth: 200 }} onPress={async () => { setBusy(true); await save({ notify: n }, 'Notification settings saved'); setBusy(false); }} />
    </Page>
  );
}

/** Phone alerts for reschedule requests: register this phone and send a test */
function PushTest() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Card style={{ gap: 8 }}>
      <Txt v="bold">Phone alerts for reschedule requests</Txt>
      <Txt v="small">An urgent alert on this phone the moment a client asks to move a session, even when Dragonfly is closed.</Txt>
      <Button small title="Send a test alert to this phone" icon="notifications_active" busy={busy} style={{ alignSelf: 'flex-start' }} onPress={async () => {
        setBusy(true);
        const st = await startPush();
        if (st === 'denied') { setBusy(false); return toast('Allow notifications for Dragonfly in your phone’s settings', false); }
        if (st === 'unavailable') { setBusy(false); return toast('Phone alerts need the Dragonfly app on your phone (they’re being switched on)', false); }
        try { const r = await callFn<{ sent: number }>('coach-push', { action: 'test' }); toast(r.sent ? 'Sent. It should go off now.' : 'This phone isn’t registered yet', !!r.sent); }
        catch (e) { toast(/not_configured/.test(String(e)) ? 'Phone alerts are almost ready: they switch on once Firebase is set up' : fnText(e), false); }
        setBusy(false);
      }} />
    </Card>
  );
}
