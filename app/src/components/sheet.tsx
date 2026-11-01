import type { AndroidSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_W, R, usePalette } from '@/lib/theme';
import { Icon, Txt } from './ui';

/** A panel that slides up from the bottom (or a centered panel on wide screens). Tapping outside closes it. */
export function Sheet({ visible, onClose, title, children, full }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode; full?: boolean }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0008' }} />
        <View style={{ width: '100%', maxWidth: MAX_W, height: full ? '94%' : undefined, maxHeight: '94%', backgroundColor: p.bg, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, paddingBottom: insets.bottom + 8 }}>
          {title !== undefined && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 }}>
              <Txt v="h2" style={{ flex: 1 }} accessibilityRole="header">{title}</Txt>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}><Icon name="close" size={26} /></Pressable>
            </View>
          )}
          {full ? children : <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>}
        </View>
      </View>
    </Modal>
  );
}

export type MenuItem = { label: string; icon?: AndroidSymbol; danger?: boolean; onPress: () => void; hidden?: boolean };
/** A list of actions in a sheet (the "…" menu on a card) */
export function ActionMenu({ visible, onClose, title, items }: { visible: boolean; onClose: () => void; title?: string; items: MenuItem[] }) {
  const p = usePalette();
  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? ''}>
      {items.filter((i) => !i.hidden).map((i) => (
        <Pressable key={i.label} accessibilityRole="button" onPress={() => { onClose(); setTimeout(i.onPress, 50); }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
          {i.icon && <Icon name={i.icon} size={22} color={i.danger ? p.danger : p.ink} />}
          <Txt v="bold" color={i.danger ? p.danger : p.ink}>{i.label}</Txt>
        </Pressable>
      ))}
    </Sheet>
  );
}
