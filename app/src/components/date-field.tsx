import RNDateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { dayKey, fromKey } from '@/lib/dates';
import { F, R, usePalette } from '@/lib/theme';
import { Icon, Txt } from './ui';

/** Date input (YYYY-MM-DD). Phones use the system date picker; the web version is date-field.web.tsx. */
export function DateField({ label, value, onChange, max, min, optional }: {
  label: string; value: string | null; onChange: (v: string | null) => void; max?: string; min?: string; optional?: boolean;
}) {
  const p = usePalette();
  const [iosOpen, setIosOpen] = useState(false);
  const current = value ? fromKey(value) : max ? fromKey(max) : new Date();
  const open = () => {
    const opts = { value: current, mode: 'date' as const, maximumDate: max ? fromKey(max) : undefined, minimumDate: min ? fromKey(min) : undefined };
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ ...opts, onChange: (e, d) => { if (e.type === 'set' && d) onChange(dayKey(d)); } });
    } else setIosOpen((o) => !o);
  };
  const shown = value ? fromKey(value).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Choose a date';
  return (
    <View style={{ marginBottom: 16 }}>
      <Txt v="bold" style={{ marginBottom: 6, fontSize: 15 }}>{label}{optional ? <Txt v="small"> (optional)</Txt> : null}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${shown}`} onPress={open}
          style={{ flex: 1, minHeight: 50, borderWidth: 1.5, borderColor: p.line, borderRadius: R.sm, paddingHorizontal: 14, backgroundColor: p.surface, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="calendar_month" size={20} color={p.muted} />
          <Txt style={{ fontFamily: F.body, color: value ? p.ink : p.muted }}>{shown}</Txt>
        </Pressable>
        {optional && value ? <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} onPress={() => onChange(null)} hitSlop={8}><Icon name="close" size={20} color={p.muted} /></Pressable> : null}
      </View>
      {Platform.OS === 'ios' && iosOpen && (
        <RNDateTimePicker value={current} mode="date" display="inline" maximumDate={max ? fromKey(max) : undefined} minimumDate={min ? fromKey(min) : undefined}
          onChange={(_e, d) => { if (d) onChange(dayKey(d)); }} />
      )}
    </View>
  );
}
