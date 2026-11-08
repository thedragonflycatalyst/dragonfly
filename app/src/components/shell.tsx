import { Image } from 'expo-image';
import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Animated, Modal, Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/lib/app-state';
import { CLIENT_SIDEBAR, COACH_SIDEBAR, COACH_TABS, type NavItem } from '@/lib/features';
import { F, MAX_W, R, usePalette, WIDE } from '@/lib/theme';
import { Ambient } from './ambient';
import { Avatar } from './avatar';
import { Icon, Txt } from './ui';

const LOGO = require('../../assets/branding/Dragonfly_128x128_NoBG.png');

/* ---------- sidebar open/closed (phones) ---------- */
let open = false;
const subs = new Set<() => void>();
const setOpen = (v: boolean) => { open = v; subs.forEach((f) => f()); };
export const openSidebar = () => setOpen(true);
const useOpen = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => open, () => open);

/** True when the sidebar stays open beside the page (web dashboard, tablets) */
export function useWide() {
  const { width } = useWindowDimensions();
  const app = useApp();
  return width >= WIDE && !!app.user && !!app.mode;
}

function Brand({ size = 34 }: { size?: number }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image source={LOGO} style={{ width: size, height: size }} contentFit="contain" accessibilityIgnoresInvertColors accessible={false} accessibilityLabel="" />
      <Text style={{ fontFamily: F.display, fontSize: 18, color: p.ink, letterSpacing: -0.3 }}>Dragonfly</Text>
    </View>
  );
}

/** Top of every main screen: menu (opens the sidebar) and brand on the left; calendar, notifications and account on the right */
export function TopBar() {
  const p = usePalette();
  const app = useApp();
  const wide = useWide();
  const btn = { width: 40, height: 40, borderRadius: R.md, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {!wide && app.user && app.mode && (
          <Pressable accessibilityRole="button" accessibilityLabel="Open menu" onPress={openSidebar} hitSlop={6} style={btn}>
            <Icon name="menu" size={22} />
          </Pressable>
        )}
        {!wide && <Pressable accessibilityRole="link" accessibilityLabel="Dragonfly home" onPress={() => router.replace('/')}><Brand size={30} /></Pressable>}
      </View>
      {app.user && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {app.mode === 'coach' && (
            <Pressable accessibilityRole="button" accessibilityLabel="QR sign-up" hitSlop={6} onPress={() => router.push('/join-qr')} style={btn}>
              <Icon name="qr_code_2" size={21} color={p.focus} />
            </Pressable>
          )}
          {app.mode && (
            <Pressable accessibilityRole="button" accessibilityLabel="Calendar" hitSlop={6} onPress={() => router.push('/calendar')} style={btn}>
              <Icon name="calendar_month" size={21} color={p.focus} />
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={6} onPress={() => router.push('/notifications')} style={btn}>
            <Icon name="notifications" size={21} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Your account, ${app.username ?? ''}`} onPress={() => router.push('/account')}>
            <Avatar size={40} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* ---------- the sidebar ---------- */
function NavRow({ item, active, onGo }: { item: NavItem; active: boolean; onGo: () => void }) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="link" accessibilityState={{ selected: active }} onPress={onGo}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, height: 42, paddingHorizontal: 12, borderRadius: R.md,
        backgroundColor: active ? p.glow : hovered || pressed ? p.soft : 'transparent',
      })}>
      <Icon name={item.icon} size={20} color={active ? p.focus : p.muted} />
      <Txt v={active ? 'bold' : 'body'} style={{ fontSize: 15 }} color={active ? p.ink : p.ink}>{item.title}</Txt>
      {active && <View style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: p.focus }} />}
    </Pressable>
  );
}

function SidebarBody({ onGo }: { onGo?: () => void }) {
  const p = usePalette();
  const app = useApp();
  const wide = useWide();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const coach = app.mode === 'coach';
  const both = !!app.trainer && app.memberships.length > 0;
  const go = (href: string) => { onGo?.(); router.push(href as Href); };
  const isActive = (href: string) => { const h = href.split('?')[0]; return h === '/coach' || h === '/me' ? path === h || path === `${h}/index` : path === h || path.startsWith(`${h}/`); };
  // On wide screens the bottom-bar places live here too
  const sections = coach ? [...(wide ? [{ title: null, items: COACH_TABS }] : []), ...COACH_SIDEBAR] : CLIENT_SIDEBAR;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 20, paddingHorizontal: 14, gap: 4 }}>
      <View style={{ paddingHorizontal: 6, paddingBottom: 12 }}><Brand /></View>
      {both && (
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: p.soft, borderRadius: R.md, padding: 3, marginBottom: 10 }}>
          {(['coach', 'client'] as const).map((m) => (
            <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: app.mode === m }}
              onPress={() => { app.setMode(m); onGo?.(); router.replace(m === 'coach' ? '/coach' : '/me'); }}
              style={{ flex: 1, height: 34, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: app.mode === m ? p.surface : 'transparent' }}>
              <Txt v={app.mode === m ? 'smallBold' : 'small'} color={p.ink}>{m === 'coach' ? 'Coaching' : 'My training'}</Txt>
            </Pressable>
          ))}
        </View>
      )}
      {sections.map((s, i) => (
        <View key={i} style={{ gap: 2, paddingTop: i ? 10 : 0, marginTop: i ? 6 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: p.line }}>
          {s.title && <Txt v="kicker" color={p.muted} style={{ textTransform: 'uppercase', paddingHorizontal: 12, paddingVertical: 6 }}>{s.title}</Txt>}
          {s.items.map((it) => <NavRow key={it.key} item={it} active={isActive(it.href)} onGo={() => go(it.href)} />)}
        </View>
      ))}
      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: p.line, gap: 8 }}>
        {coach && <NavRow item={{ key: 'team', title: app.team ? app.team.name : 'Team', icon: 'groups', href: '/team' }} active={isActive('/team')} onGo={() => go('/team')} />}
        <NavRow item={{ key: 'guide', title: 'Quickstart guide', icon: 'school', href: '/guide' }} active={false} onGo={() => go('/guide')} />
        <NavRow item={{ key: 'feedback', title: 'Send feedback', icon: 'lightbulb', href: '/feedback' }} active={isActive('/feedback')} onGo={() => go(`/feedback?from=${encodeURIComponent(path)}`)} />
        <NavRow item={{ key: 'out', title: 'Sign out', icon: 'logout', href: '/' }} active={false} onGo={async () => { onGo?.(); await app.signOut(); router.replace('/'); }} />
      </View>
    </ScrollView>
  );
}

/** Always-open sidebar beside the page on wide screens */
export function SidebarRail() {
  const p = usePalette();
  return <View role="navigation" style={{ width: 252, borderRightWidth: 1, borderRightColor: p.line, backgroundColor: p.surface }}><SidebarBody /></View>;
}

/** Slide-in sidebar on phones (opened by the menu button) */
export function SidebarDrawer() {
  const p = usePalette();
  const isOpen = useOpen();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(x, { toValue: isOpen ? 1 : 0, duration: 160, useNativeDriver: true }).start(); }, [isOpen, x]);
  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Animated.View style={{ width: 290, maxWidth: '84%', backgroundColor: p.surface, borderRightWidth: 1, borderRightColor: p.line,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-290, 0] }) }] }}>
          <SidebarBody onGo={() => setOpen(false)} />
        </Animated.View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(5,5,10,0.55)' }} />
      </View>
    </Modal>
  );
}

/** Page frame: ambient artwork, top bar, a heading, and content kept to a readable column on wide screens. */
export function Screen({ title, kicker, right, children, onRefresh, refreshing = false, bar = true, scroll = true }: {
  title?: string; kicker?: string; right?: ReactNode; children: ReactNode; onRefresh?: () => void; refreshing?: boolean; bar?: boolean; scroll?: boolean;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Ambient />
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" scrollEnabled={scroll}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.ink} /> : undefined}
        contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 48, paddingHorizontal: 16, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W }}>
          {bar && <TopBar />}
          {(title || right) && <Heading title={title} kicker={kicker} right={right} />}
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

export function Heading({ title, kicker, right }: { title?: string; kicker?: string; right?: ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 14, marginBottom: 18, flexWrap: 'wrap' }}>
      <View style={{ flexShrink: 1 }}>
        {kicker && <Txt v="kicker" color={p.focus} style={{ textTransform: 'uppercase' }}>{kicker}</Txt>}
        {title && <Txt v="h1" accessibilityRole="header">{title}</Txt>}
      </View>
      {right}
    </View>
  );
}

/** Small status label: always text, never colour alone */
export function Badge({ text, color }: { text: string; color?: string }) {
  const p = usePalette();
  const c = color ?? p.muted;
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: R.pill, borderWidth: 1, borderColor: c, paddingHorizontal: 9, paddingVertical: 2 }}>
      <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: c }}>{text}</Text>
    </View>
  );
}
