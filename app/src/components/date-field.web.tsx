import { createElement } from 'react';
import { Pressable, View } from 'react-native';
import { F, R, usePalette } from '@/lib/theme';
import { Icon, Txt } from './ui';

/** Date input for the web dashboard: the browser's own date picker. */
export function DateField({ label, value, onChange, max, min, optional }: {
  label: string; value: string | null; onChange: (v: string | null) => void; max?: string; min?: string; optional?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={{ marginBottom: 16 }}>
      <Txt v="bold" style={{ marginBottom: 6, fontSize: 15 }}>{label}{optional ? <Txt v="small"> (optional)</Txt> : null}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {createElement('input', {
          type: 'date', value: value ?? '', max, min, 'aria-label': label,
          onChange: (e: { target: { value: string } }) => onChange(e.target.value || null),
          style: {
            flex: 1, minHeight: 50, boxSizing: 'border-box', border: `1.5px solid ${p.line}`, borderRadius: R.sm, padding: '0 14px',
            backgroundColor: p.surface, color: p.ink, fontFamily: F.body, fontSize: 17, colorScheme: p.scheme,
          },
        })}
        {optional && value ? <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} onPress={() => onChange(null)} hitSlop={8}><Icon name="close" size={20} color={p.muted} /></Pressable> : null}
      </View>
    </View>
  );
}
