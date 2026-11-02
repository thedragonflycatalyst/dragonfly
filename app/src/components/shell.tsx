import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/lib/app-state';
import { F, MAX_W, R, usePalette } from '@/lib/theme';
import { Icon } from './ui';
import { Avatar } from './avatar';
import { Txt } from './ui';

/** Brand, coach/client switch (for people who are both) and the account button. */
export function TopBar() {
  const p = usePalette();
  const app = useApp();
  const both = !!app.trainer && app.memberships.length > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 12 }}>
      <Pressable accessibilityRole="link" accessibilityLabel="Home" onPress={() => router.replace('/')}>
        <Text style={{ fontFamily: F.displayBold, fontSize: 19, color: p.ink }}>Dragonfly</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {both && (
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: p.soft, borderRadius: R.pill, padding: 3 }}>
            {(['coach', 'client'] as const).map((m) => (
              <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: app.mode === m }}
                onPress={() => { app.setMode(m); router.replace(m === 'coach' ? '/coach' : '/me'); }}
                style={{ paddingHorizontal: 12, height: 32, borderRadius: R.pill, justifyContent: 'center', backgroundColor: app.mode === m ? p.surface : 'transparent' }}>
                <Text style={{ fontFamily: app.mode === m ? F.bodyBold : F.body, fontSize: 14, color: p.ink }}>{m === 'coach' ? 'Coaching' : 'My training'}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {app.user && (
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={8} onPress={() => router.push('/notifications')}>
            <Icon name="notifications" size={26} />
          </Pressable>
        )}
        {app.user && (
          <Pressable accessibilityRole="button" accessibilityLabel={`Your account, ${app.username ?? ''}`} onPress={() => router.push('/account')}>
            <Avatar size={38} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Page frame: top bar, a heading, and content kept to a readable column on wide screens. */
export function Screen({ title, kicker, right, children, onRefresh, refreshing = false, bar = true }: {
  title?: string; kicker?: string; right?: ReactNode; children: ReactNode; onRefresh?: () => void; refreshing?: boolean; bar?: boolean;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.ink} /> : undefined}
      contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 48, paddingHorizontal: 16, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: MAX_W }}>
        {bar && <TopBar />}
        {(title || right) && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 14, marginBottom: 18, flexWrap: 'wrap' }}>
            <View style={{ flexShrink: 1 }}>
              {kicker && <Txt v="kicker" color={p.focus} style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>{kicker}</Txt>}
              {title && <Txt v="h1" accessibilityRole="header">{title}</Txt>}
            </View>
            {right}
          </View>
        )}
        {children}
      </View>
    </ScrollView>
  );
}

/** Small status label */
export function Badge({ text, color }: { text: string; color?: string }) {
  const p = usePalette();
  const c = color ?? p.muted;
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: R.pill, borderWidth: 1, borderColor: c, paddingHorizontal: 9, paddingVertical: 2 }}>
      <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: c }}>{text}</Text>
    </View>
  );
}
