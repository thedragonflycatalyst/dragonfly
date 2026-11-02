import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { Screen } from '@/components/shell';
import { Button, Card, Txt } from '@/components/ui';
import { DEFAULT_RESET, HomeGrid } from '@/features/home-grid';
import { useCheckins } from '@/features/checkin-data';
import { useApp } from '@/lib/app-state';
import { dueLabel } from '@/lib/checkins';
import { DEFAULT_SHORTCUTS, SHORTCUTS } from '@/lib/features';
import { recall, store } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

const KEY = (uid: string) => `home.shortcuts.${uid}`;
DEFAULT_RESET.current = DEFAULT_SHORTCUTS;

/** Trainer home: the shortcut panels they picked, and who's due a check-in */
export default function Hub() {
  const p = usePalette();
  const app = useApp();
  const uid = app.user?.id ?? '';
  const [keys, setKeys] = useState<string[]>(() => recall<string[]>(KEY(uid), DEFAULT_SHORTCUTS));
  const [editing, setEditing] = useState(false);
  const save = (k: string[]) => { setKeys(k); store(KEY(uid), k); };
  const tiles = keys.map((k) => SHORTCUTS.find((s) => s.key === k)).filter((x): x is (typeof SHORTCUTS)[number] => !!x);
  const [dragging, setDragging] = useState(false);
  return (
    <Screen kicker={app.trainer?.business_name ?? 'Coaching'} title={`Hi ${app.trainer?.display_name ?? ''}`} scroll={!dragging}
      right={editing ? <Button small icon="check" title="Done" onPress={() => setEditing(false)} />
        : <Button small kind="ghost" icon="tune" title="Arrange" onPress={() => setEditing(true)} />}>
      {editing && <Txt v="small" style={{ marginBottom: 14 }}>Drag tiles to move them. Tap − to remove. Everything here is also in the menu.</Txt>}
      <HomeGrid items={tiles} all={SHORTCUTS} keys={keys} onChange={save} editing={editing} setEditing={setEditing} onDragging={setDragging} />
      {!editing && <DueCard />}
    </Screen>
  );
}

/** Who's due a personal check-in */
function DueCard() {
  const p = usePalette();
  const app = useApp();
  const { rows, load } = useCheckins(app.trainer?.checkin_every_days ?? 14);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const due = (rows ?? []).filter((r) => r.due.status === 'overdue' || r.due.status === 'today').sort((a, b) => a.due.days - b.due.days);
  if (!due.length) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/checkins')} style={{ marginTop: 16 }}>
      <Card style={{ gap: 6, borderWidth: 1.5, borderColor: p.gold }}>
        <Txt v="bold">{due.length} check-in{due.length === 1 ? '' : 's'} due</Txt>
        {due.slice(0, 4).map((r) => <Txt key={r.client.id} v="small">{r.client.name} · {dueLabel(r.due).toLowerCase()}{r.signals[0] ? ` · ${r.signals[0].text.toLowerCase()}` : ''}</Txt>)}
      </Card>
    </Pressable>
  );
}
