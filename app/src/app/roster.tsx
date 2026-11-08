// The roster: clients grouped by how often they train, with last session and credits left, so lapsed
// clients are visible and cancellations are easy to fill.
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Card, Press, Txt, useToast } from '@/components/ui';
import { loadPool } from '@/features/fill-slot';
import { useApp } from '@/lib/app-state';
import { effectiveTier, TIERS, type Tier } from '@/lib/client-pool';
import { errText } from '@/lib/model';
import { MAX_W, usePalette } from '@/lib/theme';

type Pool = Awaited<ReturnType<typeof loadPool>>;

export default function Roster() {
  const p = usePalette();
  const app = useApp();
  const toast = useToast();
  const [pool, setPool] = useState<Pool | null>(null);
  useFocusEffect(useCallback(() => {
    if (!app.trainer) return;
    loadPool(app.trainer.user_id).then(setPool, (e: unknown) => toast(errText(e), false));
  }, [app.trainer, toast]));
  const now = new Date();
  const groups = new Map<Tier, Pool['clients']>();
  for (const c of pool?.clients.filter((x) => x.status === 'active' || x.status === 'invited') ?? []) {
    const t = effectiveTier(c, pool!.lastSeen[c.id] ?? null, now);
    groups.set(t, [...(groups.get(t) ?? []), c]);
  }
  const ago = (iso: string | null | undefined) => {
    if (!iso) return 'No sessions yet';
    const d = Math.floor((now.getTime() - new Date(iso).getTime()) / 86400_000);
    return d === 0 ? 'Trained today' : `Last session ${d} day${d === 1 ? '' : 's'} ago`;
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
      <Stack.Screen options={{ title: 'Roster' }} />
      <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
        <Txt v="small">To fill a cancellation, open the session on your calendar and choose “Cancel and fill this slot”. Set each client’s group and free times on their profile.</Txt>
        {!pool ? <Txt>Loading…</Txt> : TIERS.map((t) => {
          const list = groups.get(t.key) ?? [];
          if (!list.length) return null;
          return (
            <View key={t.key} style={{ gap: 6 }}>
              <Txt v="kicker" color={t.key === 'lapsed' ? p.danger : p.focus}>{t.label} · {list.length}</Txt>
              <Card style={{ padding: 0 }}>
                {list.sort((a, b) => a.name.localeCompare(b.name)).map((c, i) => {
                  const credits = pool.credits[c.id];
                  return (
                    <Press key={c.id} onPress={() => router.push({ pathname: '/clients/[id]', params: { id: c.id } })}
                      style={{ padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(127,127,127,.2)', gap: 2 }} accessibilityRole="button">
                      <Txt v="bold">{c.name}{c.short_notice_ok ? ' · short notice ok' : ''}{c.client_of === 'ca' ? ' · CA' : ''}</Txt>
                      <Txt v="small">{[ago(pool.lastSeen[c.id]), credits != null ? `${credits} credit${credits === 1 ? '' : 's'} left` : null, pool.windows.some((w) => w.client_id === c.id) ? null : 'no free times saved'].filter(Boolean).join(' · ')}</Txt>
                    </Press>
                  );
                })}
              </Card>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
