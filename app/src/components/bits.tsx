import type { AndroidSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { ClientStatus } from '@/lib/model';
import { F, R, usePalette } from '@/lib/theme';
import { Icon, Txt } from './ui';

/** A row of mutually exclusive options (like tabs within a page). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const p = usePalette();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: p.soft, borderRadius: R.md, padding: 3, alignSelf: 'flex-start', maxWidth: '100%', borderWidth: 1, borderColor: p.line }}>
      {options.map(([k, label]) => {
        const on = k === value;
        return (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(k)}
            style={{ flexShrink: 1, paddingHorizontal: options.length > 3 ? 10 : 14, height: 34, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? p.focus : 'transparent' }}>
            <Text numberOfLines={1} style={{ fontFamily: on ? F.bodyBold : F.body, fontSize: 14, color: on ? p.onAccent : p.ink }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tappable list row: icon, title, optional detail, chevron or a right-hand element. */
export function Row({ icon, title, sub, onPress, right, danger, disabled, last, busy }: {
  icon?: AndroidSymbol; title: string; sub?: string | null; onPress?: () => void; right?: ReactNode;
  danger?: boolean; disabled?: boolean; last?: boolean; busy?: boolean;
}) {
  const p = usePalette();
  const color = danger ? p.danger : disabled ? p.muted : p.ink;
  return (
    <Pressable onPress={disabled ? undefined : onPress} disabled={disabled || !onPress} accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.7 : 1 })}>
      {icon && <Icon name={icon} size={22} color={danger ? p.danger : disabled ? p.muted : p.focus} />}
      <View style={{ flex: 1, gap: 1 }}>
        <Txt v="bold" color={color}>{title}</Txt>
        {sub ? <Txt v="small" numberOfLines={2}>{sub}</Txt> : null}
      </View>
      {busy ? <ActivityIndicator color={p.ink} /> : right ?? (onPress && !disabled ? <Icon name="chevron_right" size={20} color={p.muted} /> : null)}
    </Pressable>
  );
}

/** Small heading above a group of rows */
export function SectionLabel({ children }: { children: string }) {
  const p = usePalette();
  return <Txt v="kicker" color={p.muted} style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 22, marginBottom: 8, marginLeft: 4 }}>{children}</Txt>;
}

/** Round initials badge for a person */
export function Initials({ name, size = 40 }: { name: string; size?: number }) {
  const p = usePalette();
  const letters = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.fill, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: F.display, fontSize: size * 0.38, color: p.onAccent }}>{letters}</Text>
    </View>
  );
}

/** Two inputs side by side on wide screens, stacked on phones */
export function Pair({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14 }}>{Array.isArray(children)
    ? children.map((c, i) => <View key={i} style={{ flexGrow: 1, flexBasis: 220 }}>{c}</View>) : children}</View>;
}

/** Shown in place of a section that arrives with a later tab */
export function ComingWith({ what }: { what: string }) {
  const p = usePalette();
  return <Txt v="small" color={p.gold}>Comes with {what}</Txt>;
}

export function statusColor(s: ClientStatus, p: ReturnType<typeof usePalette>) {
  return s === 'active' ? p.good : s === 'invited' || s === 'lead' ? p.gold : s === 'frozen' ? p.focus : p.muted;
}
