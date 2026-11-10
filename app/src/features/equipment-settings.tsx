// Machine and bench settings on an exercise in a workout (owner, Nov 10 2026). Last time's settings are filled in;
// change any slot or add your own (e.g. "Pin 5"). Saved with the session, so next week starts from them.
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Icon, Txt } from '@/components/ui';
import { usePalette } from '@/lib/theme';

export function EquipmentSettings({ fields, value, onChange }: { fields: string[]; value: Record<string, string> | undefined; onChange: (v: Record<string, string>) => void }) {
  const p = usePalette();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const keys = [...fields, ...Object.keys(value ?? {}).filter((k) => !fields.includes(k))].slice(0, 8);
  if (!keys.length && !adding) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setAdding(true)} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
        <Txt v="small" color={p.focus}>+ Machine setting</Txt>
      </Pressable>
    );
  }
  const set = (k: string, v: string) => onChange({ ...(value ?? {}), [k]: v.slice(0, 20) });
  const box = { borderWidth: 1, borderColor: p.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, minWidth: 44, color: p.ink, fontSize: 15, textAlign: 'center' as const };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="tune" size={16} color={p.muted} />
        <Txt v="smallBold">Machine settings</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {keys.map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt v="small">{k}</Txt>
            <TextInput value={value?.[k] ?? ''} onChangeText={(t) => set(k, t)} placeholder="–" placeholderTextColor={p.muted}
              accessibilityLabel={`${k} setting`} style={box} maxLength={20} />
          </View>
        ))}
        {adding ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TextInput autoFocus value={label} onChangeText={setLabel} placeholder="Setting name" placeholderTextColor={p.muted} maxLength={30}
              accessibilityLabel="New setting name" style={{ ...box, minWidth: 120, textAlign: 'left' }}
              onSubmitEditing={() => { if (label.trim()) set(label.trim(), ''); setLabel(''); setAdding(false); }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Add setting" hitSlop={6}
              onPress={() => { if (label.trim()) set(label.trim(), ''); setLabel(''); setAdding(false); }}>
              <Icon name="check" size={20} color={p.focus} />
            </Pressable>
          </View>
        ) : keys.length < 8 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Add a machine setting" onPress={() => setAdding(true)} hitSlop={6} style={{ justifyContent: 'center' }}>
            <Txt v="small" color={p.focus}>+ Add</Txt>
          </Pressable>
        )}
      </View>
    </View>
  );
}
