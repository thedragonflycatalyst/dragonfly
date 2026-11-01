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
  mail: 'envelope', key: 'key', devices: 'laptopcomputer.and.iphone', download: 'square.and.arrow.down', expand_less: 'chevron.up', person: 'person', schedule: 'clock',
  document_scanner: 'doc.viewfinder', flash_on: 'bolt.fill', flash_off: 'bolt.slash', photo_library: 'photo.on.rectangle',
  group_add: 'person.2.badge.plus', person_add: 'person.badge.plus', content_copy: 'doc.on.doc', fitness_center: 'dumbbell', swap_horiz: 'arrow.left.arrow.right',
  sports_gymnastics: 'figure.strengthtraining.traditional', link: 'link', pause: 'pause.circle', archive: 'archivebox', badge: 'person.text.rectangle',
  chat_bubble: 'bubble.right', send: 'paperplane.fill', reply: 'arrowshape.turn.up.left', more_horiz: 'ellipsis',
};
export function Icon({ name, size = 22, color }: { name: AndroidSymbol; size?: number; color?: string }) {
  const p = usePalette();
  return <SymbolView name={{ android: name, ios: SF[name] ?? 'circle', web: name }} size={size} tintColor={color ?? p.ink} />;
}

/* ---------- buttons ---------- */
type BtnKind = 'solid' | 'ghost' | 'quiet' | 'danger' | 'accent' | 'on';
export function Button({ title, onPress, kind = 'solid', icon, small, busy, disabled, accent, style, haptic = true, tight }: {
  title?: string; tight?: boolean; onPress?: () => void; kind?: BtnKind; icon?: AndroidSymbol; small?: boolean; busy?: boolean; disabled?: boolean;
  accent?: string; style?: StyleProp<ViewStyle>; haptic?: boolean;
}) {
  const p = usePalette();
  const bg = { solid: p.ink, ghost: 'transparent', quiet: p.soft, danger: 'transparent', accent: accent ?? p.focus, on: p.good }[kind];
  const fg = { solid: p.bg, ghost: p.ink, quiet: p.ink, danger: p.danger, accent: p.onAccent, on: p.onAccent }[kind];
  const border = kind === 'ghost' ? p.line : kind === 'danger' ? p.danger : 'transparent';
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={title} disabled={disabled || busy}
      onPress={() => { if (haptic) Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [
        { backgroundColor: bg, borderColor: border, borderWidth: 1.5, minHeight: small ? 38 : 50, paddingHorizontal: title ? (small ? 14 : tight ? 10 : 20) : 0,
          width: title ? undefined : small ? 38 : 50, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}>
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Icon name={icon} size={small ? 18 : 20} color={fg} />}
          {title && <Text style={[styles.bold, { color: fg, fontSize: small ? 15 : 16 }]} numberOfLines={1}>{title}</Text>}
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, emoji, selected, onPress, color }: { label: string; emoji?: string; selected?: boolean; onPress?: () => void; color?: string }) {
  const p = usePalette();
  const on = color ?? p.ink;
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [styles.chip, { backgroundColor: selected ? on : p.surface, borderColor: selected ? on : p.line, opacity: pressed ? 0.8 : 1 }]}>
      {emoji && <Text style={{ fontSize: 16 }}>{emoji}</Text>}
      <Text style={[selected ? styles.bold : styles.body, { fontSize: 15, color: selected ? (color ? p.onAccent : p.bg) : p.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <View style={[styles.card, { backgroundColor: p.surface, shadowColor: p.scheme === 'dark' ? '#000' : '#1b1622' }, style]}>{children}</View>;
}

export function Field({ label, hint, style, ...input }: TextInputProps & { label: string; hint?: string; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Txt v="bold" style={{ marginBottom: 6, fontSize: 15 }}>{label}{hint ? <Txt v="small"> {hint}</Txt> : null}</Txt>
      <TextInput
        placeholderTextColor={p.muted} {...input}
        onFocus={(e) => { setFocus(true); input.onFocus?.(e); }} onBlur={(e) => { setFocus(false); input.onBlur?.(e); }}
        style={[styles.input, { backgroundColor: p.surface, color: p.ink, borderColor: focus ? p.focus : p.line }, input.multiline && { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }, style]}
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
        style={[styles.toast, { top: insets.top + 8, backgroundColor: p.ink, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <Text style={[styles.bold, { color: p.bg, textAlign: 'center' }]}>{msg}</Text>
      </Animated.View>
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: F.display, fontSize: 38, lineHeight: 40, letterSpacing: -1 },
  h1: { fontFamily: F.display, fontSize: 30, lineHeight: 33, letterSpacing: -0.6 },
  h2: { fontFamily: F.display, fontSize: 23, lineHeight: 27, letterSpacing: -0.4 },
  h3: { fontFamily: F.displayBold, fontSize: 18, lineHeight: 22 },
  body: { fontFamily: F.body, fontSize: 17, lineHeight: 25 },
  bold: { fontFamily: F.bodyBold, fontSize: 17, lineHeight: 23 },
  small: { fontFamily: F.body, fontSize: 14, lineHeight: 20 },
  smallBold: { fontFamily: F.bodyBold, fontSize: 14, lineHeight: 20 },
  kicker: { fontFamily: F.bodyBold, fontSize: 14, lineHeight: 19 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingHorizontal: 15, borderRadius: R.pill, borderWidth: 1 },
  card: { borderRadius: R.lg, padding: 16, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  input: { minHeight: 50, borderWidth: 1.5, borderRadius: R.sm, paddingHorizontal: 14, fontFamily: F.body, fontSize: 17 },
  toast: { position: 'absolute', left: 20, right: 20, paddingVertical: 13, paddingHorizontal: 18, borderRadius: R.pill, elevation: 8, zIndex: 100 },
});
