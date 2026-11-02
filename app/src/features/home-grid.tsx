import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, View, type PanResponderInstance } from 'react-native';
import { Button, Card, Icon, Txt } from '@/components/ui';
import type { NavItem } from '@/lib/features';
import { R, usePalette } from '@/lib/theme';

const GAP = 12;
// No text highlighting while dragging on the web dashboard
const NO_SELECT = { userSelect: 'none' } as object;
const TILE_H = 104;
const buzz = (heavy = false) => { Haptics.impactAsync(heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };

/** Move one key to a new position */
export function moveKey(keys: string[], key: string, to: number): string[] {
  const n = keys.filter((k) => k !== key);
  n.splice(Math.max(0, Math.min(to, n.length)), 0, key);
  return n;
}

/**
 * Home-screen style shortcut grid. Long-press a tile to start arranging: tiles wiggle, drag one to move it,
 * tap the minus to remove, and add more from the tray below. Screen readers get Move/Remove actions instead of dragging.
 */
export function HomeGrid({ items, all, keys, onChange, editing, setEditing, onDragging }: {
  items: NavItem[]; all: NavItem[]; keys: string[]; onChange: (k: string[]) => void;
  editing: boolean; setEditing: (v: boolean) => void; onDragging: (v: boolean) => void;
}) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const cols = width < 560 ? 2 : width < 820 ? 3 : 4;
  const tileW = width ? (width - GAP * (cols - 1)) / cols : 0;
  const slot = (i: number) => ({ x: (i % cols) * (tileW + GAP), y: Math.floor(i / cols) * (TILE_H + GAP) });

  // Live values the gesture handlers read
  const live = useRef({ keys, cols, tileW, onChange, dragKey: null as string | null, start: { x: 0, y: 0 } });
  live.current.keys = keys; live.current.cols = cols; live.current.tileW = tileW; live.current.onChange = onChange;

  const pos = useRef(new Map<string, Animated.ValueXY>()).current;
  const posOf = (k: string, i: number) => {
    let v = pos.get(k);
    if (!v) { v = new Animated.ValueXY(slot(i)); pos.set(k, v); }
    return v;
  };
  // Everything except the tile in your finger glides to its slot
  useEffect(() => {
    keys.forEach((k, i) => {
      if (k === dragKey) return;
      const v = pos.get(k);
      if (v) Animated.spring(v, { toValue: slot(i), useNativeDriver: false, speed: 18, bounciness: 6 }).start();
    });
  }, [keys, dragKey, cols, tileW]); // eslint-disable-line react-hooks/exhaustive-deps

  const wiggle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!editing) { wiggle.setValue(0); return; }
    const a = Animated.loop(Animated.sequence([
      Animated.timing(wiggle, { toValue: 1, duration: 120, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -1, duration: 240, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0, duration: 120, easing: Easing.linear, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [editing, wiggle]);

  const responders = useRef(new Map<string, PanResponderInstance>()).current;
  const responderFor = (k: string) => {
    let r = responders.get(k);
    if (r) return r;
    r = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const L = live.current;
        const i = L.keys.indexOf(k);
        L.start = { x: (i % L.cols) * (L.tileW + GAP), y: Math.floor(i / L.cols) * (TILE_H + GAP) };
        L.dragKey = k; setDragKey(k); onDragging(true); buzz();
      },
      onPanResponderMove: (_e, g) => {
        const L = live.current;
        const x = L.start.x + g.dx, y = L.start.y + g.dy;
        pos.get(k)?.setValue({ x, y });
        const col = Math.max(0, Math.min(L.cols - 1, Math.floor((x + L.tileW / 2) / (L.tileW + GAP))));
        const row = Math.max(0, Math.floor((y + TILE_H / 2) / (TILE_H + GAP)));
        const to = Math.min(L.keys.length - 1, row * L.cols + col);
        if (L.keys.indexOf(k) !== to) { const n = moveKey(L.keys, k, to); L.keys = n; L.onChange(n); buzz(); }
      },
      onPanResponderRelease: () => end(),
      onPanResponderTerminate: () => end(),
    });
    const end = () => { live.current.dragKey = null; setDragKey(null); onDragging(false); };
    responders.set(k, r);
    return r;
  };

  const rows = Math.max(1, Math.ceil(items.length / cols));
  const spare = all.filter((s) => !keys.includes(s.key));
  const rot = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-1.4deg', '1.4deg'] });

  return (
    <View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[{ height: width ? rows * (TILE_H + GAP) - GAP : TILE_H }, editing && NO_SELECT]}>
        {width > 0 && items.map((a, i) => {
          const v = posOf(a.key, i);
          const lifted = dragKey === a.key;
          const tile = (
            <Card style={{ height: TILE_H, justifyContent: 'space-between', gap: 10, borderColor: lifted ? p.focus : p.line }}>
              <Icon name={a.icon} size={26} color={p.focus} />
              <Txt v="bold" numberOfLines={1}>{a.title}</Txt>
            </Card>
          );
          return (
            <Animated.View key={a.key} style={{ position: 'absolute', width: tileW, height: TILE_H, zIndex: lifted ? 10 : 1,
              transform: [{ translateX: v.x }, { translateY: v.y }, { scale: lifted ? 1.06 : 1 }] }}>
              {editing ? (
                <Animated.View {...responderFor(a.key).panHandlers} style={{ flex: 1, transform: [{ rotate: lifted ? '0deg' : i % 2 ? rot : wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['1.4deg', '-1.4deg'] }) }] }}
                  accessible accessibilityLabel={`${a.title}. Drag to move.`}
                  accessibilityActions={[{ name: 'earlier', label: 'Move earlier' }, { name: 'later', label: 'Move later' }, { name: 'remove', label: 'Remove' }]}
                  onAccessibilityAction={(e) => {
                    const n = e.nativeEvent.actionName;
                    if (n === 'remove') onChange(keys.filter((x) => x !== a.key));
                    else onChange(moveKey(keys, a.key, i + (n === 'earlier' ? -1 : 1)));
                  }}>
                  {tile}
                </Animated.View>
              ) : null}
              {editing && !lifted && (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${a.title}`} hitSlop={8}
                  onPress={() => { buzz(); onChange(keys.filter((x) => x !== a.key)); }}
                  style={({ pressed }) => ({ position: 'absolute', top: 6, right: 6, width: 34, height: 34, borderRadius: 17, zIndex: 5, elevation: 5,
                    backgroundColor: pressed ? p.danger : p.raise, borderWidth: 1, borderColor: p.line, alignItems: 'center', justifyContent: 'center' })}>
                  <Icon name="remove" size={20} color={p.ink} />
                </Pressable>
              )}
              {!editing && (
                <Pressable accessibilityRole="button" accessibilityHint="Long-press to arrange your shortcuts" delayLongPress={450}
                  onPress={() => router.push(a.href as Href)} onLongPress={() => { buzz(true); setEditing(true); }}
                  style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1 })}>
                  {tile}
                </Pressable>
              )}
            </Animated.View>
          );
        })}
        {width > 0 && items.length === 0 && (
          <Card style={{ height: TILE_H, justifyContent: 'center' }}><Txt v="small">No shortcuts. Add some from the list below.</Txt></Card>
        )}
      </View>

      {editing && (
        <View style={{ marginTop: 20, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt v="bold">Add shortcuts</Txt>
            <Button small kind="quiet" title="Reset" onPress={() => onChange(DEFAULT_RESET.current)} />
          </View>
          {spare.length === 0 ? <Txt v="small">Everything is already on your Home.</Txt> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {spare.map((s) => (
                <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={`Add ${s.title}`} onPress={() => { buzz(); onChange([...keys, s.key]); }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 40, borderRadius: R.md, borderWidth: 1, borderColor: p.line, backgroundColor: pressed ? p.soft : p.surface })}>
                  <Icon name={s.icon} size={18} color={p.focus} /><Txt v="small" color={p.ink}>{s.title}</Txt><Icon name="add" size={16} color={p.muted} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** Set by the Home screen so Reset knows the defaults */
export const DEFAULT_RESET = { current: [] as string[] };
