import * as Haptics from 'expo-haptics';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { F, R, usePalette } from '@/lib/theme';

/* ---------- type ---------- */
type TxtProps = TextProps & { v?: 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bold' | 'small' | 'smallBold' | 'kicker'; color?: string; center?: boolean };
export function Txt({ v = 'body', color, center, style, ...rest }: TxtProps) {
  const p = usePalette();
  return <Text {...rest} style={[styles[v], { color: color ?? (v === 'small' ? p.muted : p.ink) }, center && { textAlign: 'center' }, style]} />;
}

/* ---------- icons: Material Symbols on Android, SF Symbols on iPhone ---------- */
const SF: Partial<Record<AndroidSymbol, SFSymbol>> = {
  search: 'magnifyingglass', tune: 'slider.horizontal.3', calendar_month: 'calendar', share: 'square.and.arrow.up', location_on: 'mappin.and.ellipse',
  confirmation_number: 'ticket', group: 'person.2', chevron_left: 'chevron.left', chevron_right: 'chevron.right', check: 'checkmark',
  photo_camera: 'camera', image: 'photo', edit_note: 'square.and.pencil', notifications: 'bell', flag: 'flag', directions: 'arrow.triangle.turn.up.right.diamond',
  close: 'xmark', logout: 'rectangle.portrait.and.arrow.right', edit: 'pencil', delete: 'trash', public: 'globe', event_available: 'calendar.badge.checkmark',
  shield_person: 'person.badge.shield.checkmark', local_fire_department: 'flame', add: 'plus', info: 'info.circle',
  mail: 'envelope', key: 'key', devices: 'laptopcomputer.and.iphone', download: 'square.and.arrow.down', expand_less: 'chevron.up', expand_more: 'chevron.down', person: 'person', schedule: 'clock',
  document_scanner: 'doc.viewfinder', flash_on: 'bolt.fill', flash_off: 'bolt.slash', photo_library: 'photo.on.rectangle',
  group_add: 'person.2.badge.plus', person_add: 'person.badge.plus', content_copy: 'doc.on.doc', fitness_center: 'dumbbell', swap_horiz: 'arrow.left.arrow.right',
  sports_gymnastics: 'figure.strengthtraining.traditional', link: 'link', pause: 'pause.circle', archive: 'archivebox', badge: 'person.text.rectangle',
  play_arrow: 'play.fill', star: 'star.fill', star_outline: 'star', video_library: 'play.rectangle.on.rectangle', arrow_upward: 'arrow.up', arrow_downward: 'arrow.down',
  timer: 'timer', folder: 'folder', drive_file_move: 'folder.badge.plus', remove: 'minus', stop_circle: 'stop.circle', volume_up: 'speaker.wave.2', skip_next: 'forward.end', bolt: 'bolt',
  home: 'house', menu: 'line.3.horizontal', ac_unit: 'snowflake', filter_list: 'line.3.horizontal.decrease', sort: 'arrow.up.arrow.down',
  description: 'doc.text', attach_file: 'paperclip', sticky_note_2: 'note.text', checklist: 'checklist', health_and_safety: 'cross.case', straighten: 'ruler',
  timeline: 'chart.xyaxis.line', settings: 'gearshape', payments: 'creditcard', event: 'calendar', groups: 'person.3', inbox: 'tray', link_off: 'personalhotspot.slash',
  push_pin: 'pin', lock: 'lock', warning: 'exclamationmark.triangle', task_alt: 'checkmark.circle', open_in_new: 'arrow.up.right.square',
  monitor_weight: 'scalemass', restaurant: 'fork.knife', watch: 'applewatch', school: 'graduationcap', visibility: 'eye', visibility_off: 'eye.slash',
  unfold_more: 'chevron.up.chevron.down', rule: 'checklist.checked', support_agent: 'person.wave.2', undo: 'arrow.uturn.backward',
  chat_bubble: 'bubble.right', send: 'paperplane.fill', reply: 'arrowshape.turn.up.left', more_horiz: 'ellipsis',
};
export function Icon({ name, size = 22, color }: { name: AndroidSymbol; size?: number; color?: string }) {
  const p = usePalette();
  return <SymbolView name={{ android: name, ios: SF[name] ?? 'circle', web: name }} size={size} tintColor={color ?? p.ink} />;
}

/* ---------- buttons ---------- */
type BtnKind = 'solid' | 'ghost' | 'quiet' | 'danger' | 'accent' | 'on';
type BtnBase = { tight?: boolean; onPress?: () => void; kind?: BtnKind; icon?: AndroidSymbol; small?: boolean; busy?: boolean; disabled?: boolean;
  accent?: string; style?: StyleProp<ViewStyle>; haptic?: boolean };
/** Icon-only buttons must say what they do (screen readers): pass `label` when there's no `title`. */
export type ButtonProps = BtnBase & ({ title: string; label?: string } | { title?: undefined; label: string });
// Small buttons and chips are 36 tall; this makes their touch area at least 44×44
const SLOP = { top: 4, bottom: 4, left: 4, right: 4 };
export function Button({ title, label, onPress, kind = 'solid', icon, small, busy, disabled, accent, style, haptic = true, tight }: ButtonProps) {
  const p = usePalette();
  // Uploader buttons: primary violet, secondary outlined, quiet tinted, danger outlined
  const bg = { solid: p.fill, ghost: p.surface, quiet: p.soft, danger: 'transparent', accent: accent ?? p.fill, on: p.good }[kind];
  const fg = { solid: p.onAccent, ghost: p.ink, quiet: p.ink, danger: p.danger, accent: p.onAccent, on: p.onGood }[kind];
  const border = kind === 'ghost' ? p.line : kind === 'danger' ? p.danger : 'transparent';
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label ?? title} accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      disabled={disabled || busy} hitSlop={small ? SLOP : undefined}
      onPress={() => { if (haptic) Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [
        { backgroundColor: bg, borderColor: border, borderWidth: 1, minHeight: small ? 36 : 46, paddingHorizontal: title ? (small ? 12 : tight ? 10 : 18) : 0,
          width: title ? undefined : small ? 36 : 46, borderRadius: R.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}>
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Icon name={icon} size={small ? 18 : 20} color={fg} />}
          {title && <Text style={[styles.bold, { color: fg, fontSize: small ? 14 : 15 }]} numberOfLines={1}>{title}</Text>}
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, emoji, selected, onPress, color }: { label: string; emoji?: string; selected?: boolean; onPress?: () => void; color?: string }) {
  const p = usePalette();
  const on = color ?? p.fill;
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} hitSlop={SLOP} onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [styles.chip, { backgroundColor: selected ? on : p.surface, borderColor: selected ? on : p.line, opacity: pressed ? 0.8 : 1 }]}>
      {emoji && <Text style={{ fontSize: 16 }}>{emoji}</Text>}
      <Text style={[selected ? styles.bold : styles.body, { fontSize: 14, color: selected ? p.onAccent : p.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.line, shadowColor: p.scheme === 'dark' ? '#000' : '#2a1f5c' }, style]}>{children}</View>;
}

export function Field({ label, hint, style, ...input }: TextInputProps & { label: string; hint?: string; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Txt v="bold" style={{ marginBottom: 6, fontSize: 14 }}>{label}{hint ? <Txt v="small"> {hint}</Txt> : null}</Txt>
      <TextInput
        placeholderTextColor={p.muted} accessibilityLabel={label} {...input}
        onFocus={(e) => { setFocus(true); input.onFocus?.(e); }} onBlur={(e) => { setFocus(false); input.onBlur?.(e); }}
        style={[styles.input, { backgroundColor: p.raise, color: p.ink, borderColor: focus ? p.focus : p.line }, input.multiline && { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }, style]}
      />
    </View>
  );
}

export function Empty({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 34, gap: 8 }}>
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
      <Txt v="h2" center>{title}</Txt>
      {body && <Txt v="small" center style={{ fontSize: 16, maxWidth: 300 }}>{body}</Txt>}
      {action && <View style={{ marginTop: 8 }}>{action}</View>}
    </Card>
  );
}

export const Press = (props: PressableProps & { style?: StyleProp<ViewStyle> }) => (
  <Pressable {...props} style={({ pressed }) => [props.style as ViewStyle, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]} />
);

/* ---------- toast ---------- */
const ToastCtx = createContext<(msg: string, ok?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState('');
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string, ok = true) => {
    setMsg(m);
    Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(), 3200);
  }, [anim]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <Animated.View pointerEvents="none" accessibilityLiveRegion="polite"
        style={[styles.toast, { top: insets.top + 8, backgroundColor: p.raise, borderColor: p.focus, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <Text style={[styles.bold, { color: p.ink, textAlign: 'center' }]}>{msg}</Text>
      </Animated.View>
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: F.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  h1: { fontFamily: F.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily: F.display, fontSize: 21, lineHeight: 27, letterSpacing: -0.3 },
  h3: { fontFamily: F.displayBold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: F.body, fontSize: 16, lineHeight: 24 },
  bold: { fontFamily: F.bodyBold, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: F.body, fontSize: 13.5, lineHeight: 19 },
  smallBold: { fontFamily: F.bodyBold, fontSize: 13.5, lineHeight: 19 },
  kicker: { fontFamily: F.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1 },
  card: { borderRadius: R.lg, padding: 16, borderWidth: 1, shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: R.md, paddingHorizontal: 14, fontFamily: F.body, fontSize: 16 },
  toast: { position: 'absolute', left: 20, right: 20, paddingVertical: 13, paddingHorizontal: 18, borderRadius: R.md, borderWidth: 1, elevation: 8, zIndex: 100 },
});
