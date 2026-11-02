import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/shell';
import { Sheet } from '@/components/sheet';
import { Button, Card, Icon, Txt } from '@/components/ui';
import { useCheckins } from '@/features/checkin-data';
import { useApp } from '@/lib/app-state';
import { dueLabel } from '@/lib/checkins';
import { DEFAULT_SHORTCUTS, SHORTCUTS } from '@/lib/features';
import { recall, store } from '@/lib/supabase';
import { R, usePalette } from '@/lib/theme';

const KEY = (uid: string) => `home.shortcuts.${uid}`;

/** Trainer home: the shortcut panels they picked, and who's due a check-in */
export default function Hub() {
  const p = usePalette();
  const app = useApp();
  const uid = app.user?.id ?? '';
  const [keys, setKeys] = useState<string[]>(() => recall<string[]>(KEY(uid), DEFAULT_SHORTCUTS));
  const [editing, setEditing] = useState(false);
  const save = (k: string[]) => { setKeys(k); store(KEY(uid), k); };
  const tiles = keys.map((k) => SHORTCUTS.find((s) => s.key === k)).filter((x): x is (typeof SHORTCUTS)[number] => !!x);
  return (
    <Screen kicker={app.trainer?.business_name ?? 'Coaching'} title={`Hi ${app.trainer?.display_name ?? ''}`}
      right={<Button small kind="ghost" icon="tune" title="Customize" onPress={() => setEditing(true)} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((a) => (
          <Pressable key={a.key} accessibilityRole="button" onPress={() => router.push(a.href as Href)} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 160, opacity: pressed ? 0.8 : 1 })}>
            <Card style={{ minHeight: 104, justifyContent: 'space-between', gap: 10 }}>
              <Icon name={a.icon} size={26} color={p.focus} />
              <Txt v="bold">{a.title}</Txt>
            </Card>
          </Pressable>
        ))}
        {tiles.length === 0 && <Card style={{ flex: 1 }}><Txt v="small">No shortcuts. Tap Customize to pick some.</Txt></Card>}
      </View>
      <DueCard />
      <Sheet visible={editing} onClose={() => setEditing(false)} title="Your shortcuts">
        <Txt v="small" style={{ marginBottom: 12 }}>Tap to add or remove. Arrows change the order. Everything here is also in the menu.</Txt>
        {keys.map((k, i) => {
          const s = SHORTCUTS.find((x) => x.key === k);
          if (!s) return null;
          return (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.line }}>
              <Icon name={s.icon} size={20} color={p.focus} />
              <Txt v="bold" style={{ flex: 1 }}>{s.title}</Txt>
              <Pressable accessibilityRole="button" accessibilityLabel={`Move ${s.title} up`} disabled={i === 0} hitSlop={6}
                onPress={() => { const n = [...keys]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; save(n); }}><Icon name="arrow_upward" size={20} color={i === 0 ? p.line : p.ink} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Move ${s.title} down`} disabled={i === keys.length - 1} hitSlop={6}
                onPress={() => { const n = [...keys]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; save(n); }}><Icon name="arrow_downward" size={20} color={i === keys.length - 1 ? p.line : p.ink} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.title}`} hitSlop={6} onPress={() => save(keys.filter((x) => x !== k))}><Icon name="close" size={20} color={p.danger} /></Pressable>
            </View>
          );
        })}
        <Txt v="smallBold" style={{ marginTop: 16, marginBottom: 8 }}>Add</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {SHORTCUTS.filter((s) => !keys.includes(s.key)).map((s) => (
            <Pressable key={s.key} accessibilityRole="button" onPress={() => save([...keys, s.key])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: R.pill, borderWidth: 1, borderColor: p.line, backgroundColor: p.soft }}>
              <Icon name="add" size={16} color={p.focus} /><Txt v="small" color={p.ink}>{s.title}</Txt>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Done" onPress={() => setEditing(false)} />
          <Button kind="quiet" title="Reset" onPress={() => save(DEFAULT_SHORTCUTS)} />
        </View>
      </Sheet>
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
