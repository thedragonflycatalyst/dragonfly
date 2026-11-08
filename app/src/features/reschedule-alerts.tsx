// Trainer: clients' reschedule requests need approval (owner 2026-11-07), so they're impossible to miss:
//  - a bright bar across the top of every screen while any request is waiting
//  - a pop-up the moment a new one comes in, with Approve / Decline right there
//  - a phone notification (when the app is open or in the background) and, once texting is on, a text
// Checked every 30 seconds and whenever the app comes back to the front.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { callFn } from '@/lib/fn';
import { errText } from '@/lib/model';
import { recall, sb, store } from '@/lib/supabase';

type Req = { id: string; client_id: string; booking_id: string; old_start: string; new_start: string; created_at: string; coach_clients: { name: string } | null };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const SEEN = 'coach.rescheduleSeen';

async function phoneAlert(n: number, name: string) {
  if (Platform.OS === 'web') {
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('Reschedule request', { body: `${name} wants to move a session. Tap to approve or decline.` }); } catch { /* optional */ }
    return;
  }
  try {
    const N = await import('expo-notifications');
    // Show it even while the app is open (Android heads-up channel with sound)
    N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }) });
    if (Platform.OS === 'android') await N.setNotificationChannelAsync('approvals', { name: 'Approvals', importance: N.AndroidImportance.MAX, sound: 'default', vibrationPattern: [0, 400, 200, 400] });
    const perm = await N.requestPermissionsAsync();
    if (!perm.granted) return;
    await N.scheduleNotificationAsync({ content: { title: n === 1 ? 'Reschedule request' : `${n} reschedule requests`, body: `${name} wants to move a session. Approve or decline in Dragonfly.`, data: { kind: 'reschedule' }, sound: true, priority: 'max' }, trigger: Platform.OS === 'android' ? { channelId: 'approvals' } : null });
  } catch { /* the bar and pop-up still show */ }
}

export function RescheduleAlerts() {
  const app = useApp();
  const toast = useToast();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<Req | null>(null);
  const [reason, setReason] = useState('');
  const seen = useRef<Set<string>>(new Set(recall<string[]>(SEEN, [])));
  const on = app.mode === 'coach' && !!app.user;

  const load = useCallback(async () => {
    if (!on) return;
    const { data } = await sb.from('coach_reschedule_requests').select('id, client_id, booking_id, old_start, new_start, created_at, coach_clients(name)')
      .eq('status', 'pending').order('created_at').limit(50);
    const list = (data as unknown as Req[] | null) ?? [];
    setReqs(list);
    const fresh = list.filter((r) => !seen.current.has(r.id));
    if (fresh.length) {
      fresh.forEach((r) => seen.current.add(r.id));
      store(SEEN, [...seen.current].slice(-200));
      setOpen(true);
      void phoneAlert(fresh.length, fresh[0].coach_clients?.name ?? 'A client');
    }
  }, [on]);
  useEffect(() => {
    if (!on) return;
    void load();
    const t = setInterval(() => { void load(); }, 30_000);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void load(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [on, load]);

  if (!on || !reqs.length) return null;
  const decide = async (r: Req, approve: boolean, why?: string) => {
    setBusy(r.id);
    const { error } = await sb.rpc('coach_reschedule_decide', { p_request: r.id, p_approve: approve, p_reason: why || null });
    setBusy(null);
    if (error) return toast(/slot_taken/.test(error.message) ? 'That time is taken now. Decline it and the client can pick another.' : /request_expired/.test(error.message) ? 'Too late: the session or the new time has already started.' : errText(error), false);
    toast(approve ? 'Approved. Your client has been told.' : 'Declined. Your client has been told.');
    setDeclining(null); setReason('');
    void callFn('coach-outbox', { action: 'send_now' }).catch(() => {});
    void load();
  };
  const n = reqs.length;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${n} reschedule request${n === 1 ? '' : 's'} waiting for your approval. Review.`} onPress={() => setOpen(true)}
        style={{ backgroundColor: '#f5b041', paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt style={{ fontSize: 20 }}>⚠️</Txt>
        <Txt v="bold" color="#14121f" style={{ flex: 1, fontSize: 16 }}>{n === 1 ? '1 reschedule request needs your approval' : `${n} reschedule requests need your approval`}</Txt>
        <View style={{ backgroundColor: '#14121f', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}><Txt v="bold" color="#ffffff">Review</Txt></View>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Reschedule requests">
        <View style={{ gap: 10 }}>
          <Txt v="small">Approving moves the session and frees the old time for your waitlist. Your client is told either way.</Txt>
          {reqs.map((r) => (
            <Card key={r.id} style={{ gap: 8 }}>
              <Txt v="h3">{r.coach_clients?.name ?? 'A client'}</Txt>
              <Txt>From <Txt v="bold">{when(r.old_start)}</Txt></Txt>
              <Txt>To <Txt v="bold">{when(r.new_start)}</Txt></Txt>
              {declining?.id === r.id ? <>
                <Field label="Reason (optional, the client sees it)" value={reason} onChangeText={setReason} maxLength={200} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button small kind="danger" title="Decline" busy={busy === r.id} onPress={() => decide(r, false, reason)} />
                  <Button small kind="ghost" title="Back" onPress={() => setDeclining(null)} />
                </View>
              </> : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button small icon="check" title="Approve" busy={busy === r.id} onPress={() => decide(r, true)} />
                  <Button small kind="ghost" title="Decline" onPress={() => { setDeclining(r); setReason(''); }} />
                </View>
              )}
            </Card>
          ))}
        </View>
      </Sheet>
    </>
  );
}
