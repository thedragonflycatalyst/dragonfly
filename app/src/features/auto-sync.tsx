import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useApp } from '@/lib/app-state';
import { callFn } from '@/lib/fn';
import type { Weighin } from '@/lib/scale';
import { sb } from '@/lib/supabase';
import { deviceSync, syncDevice } from './health-sync';
import { healthSync, syncHealth } from './scale-sync';

const GAP = 30 * 60_000;

/** Quietly brings in new data from connected apps when Dragonfly opens or comes back to the front (at most every 30 minutes) */
export function AutoSync() {
  const { user, membership, viewing } = useApp();
  const last = useRef(0);
  useEffect(() => {
    if (!user || viewing) return;
    const run = async () => {
      if (Date.now() - last.current < GAP) return;
      last.current = Date.now();
      const uid = user.id;
      if (Platform.OS === 'android') {
        if (deviceSync(uid).on) await syncDevice(uid, membership).catch(() => {});
        const w = healthSync(uid);
        if (w.on) {
          const since = new Date((w.last ? new Date(w.last).getTime() : Date.now()) - 33 * 86_400_000).toISOString();
          const { data } = await sb.from('coach_weighins').select('*').eq('user_id', uid).gte('measured_at', since);
          await syncHealth(uid, (data ?? []) as Weighin[]).catch(() => {});
        }
      }
      const { data: conns } = await sb.from('coach_connections').select('provider,last_sync_at,status').eq('user_id', uid);
      if ((conns ?? []).some((c) => c.status === 'ok' && (!c.last_sync_at || Date.now() - new Date(c.last_sync_at).getTime() > 3 * 3600_000))) {
        await callFn('coach-connect', { action: 'sync' }).catch(() => {});
      }
    };
    run();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') run(); });
    return () => sub.remove();
  }, [user, membership, viewing]);
  return null;
}
