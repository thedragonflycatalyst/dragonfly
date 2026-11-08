// Trainer to-dos that stay until marked done (e.g. "Reschedule Susan in ClubAutomation from … to …"; any outside calendar): a red bar on
// every screen, and on Android a notification that can't be swiped away until it's done. The server also sends a
// phone alert every hour (8 AM–9 PM) while any is open.
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { Txt } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { sb } from '@/lib/supabase';

export type Followup = { id: string; title: string; created_at: string; status: string; done_at: string | null };

async function stickyNotes(open: Followup[]) {
  if (Platform.OS !== 'android') return;
  try {
    const N = await import('expo-notifications');
    const shown = await N.getPresentedNotificationsAsync();
    const ids = new Set(open.map((f) => `followup-${f.id}`));
    for (const n of shown) if (n.request.identifier.startsWith('followup-') && !ids.has(n.request.identifier)) await N.dismissNotificationAsync(n.request.identifier);
    for (const f of open) {
      if (shown.some((n) => n.request.identifier === `followup-${f.id}`)) continue;
      await N.scheduleNotificationAsync({ identifier: `followup-${f.id}`,
        content: { title: '📋 Update your calendar', body: `${f.title}. Tap Done in Dragonfly when it's changed.`, sticky: true, autoDismiss: false, data: { kind: 'followup', path: '/followups' } },
        trigger: { channelId: 'approvals' } });
    }
  } catch { /* the bar still shows */ }
}

/** Open follow-ups for the signed-in trainer, refreshed every 30 seconds and when the app comes back */
export function useFollowups(): [Followup[], () => Promise<void>] {
  const app = useApp();
  const on = app.mode === 'coach' && !!app.user;
  const [list, setList] = useState<Followup[]>([]);
  const load = useCallback(async () => {
    if (!on) return;
    const { data } = await sb.from('coach_followups').select('id, title, created_at, status, done_at').eq('status', 'open').order('created_at');
    const open = (data as Followup[] | null) ?? [];
    setList(open);
    void stickyNotes(open);
  }, [on]);
  useEffect(() => {
    if (!on) return;
    void load();
    const t = setInterval(() => { void load(); }, 30_000);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void load(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [on, load]);
  return [list, load];
}

export function FollowupBar() {
  const [open] = useFollowups();
  if (!open.length) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${open.length} calendar change${open.length === 1 ? '' : 's'} to make. Open.`} onPress={() => router.push('/followups')}
      style={{ backgroundColor: '#c23a3a', paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Txt style={{ fontSize: 20 }}>📋</Txt>
      <View style={{ flex: 1 }}>
        <Txt v="bold" color="#ffffff" style={{ fontSize: 16 }}>{open.length === 1 ? (open[0].title.startsWith('Reschedule') || open[0].title.startsWith('Cancel') ? 'Update your calendar' : 'Heads-up') : `To do (${open.length})`}</Txt>
        <Txt color="#ffffff" numberOfLines={1}>{open[0].title}</Txt>
      </View>
      <View style={{ backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}><Txt v="bold" color="#c23a3a">Open</Txt></View>
    </Pressable>
  );
}
