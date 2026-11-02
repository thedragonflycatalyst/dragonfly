import { router, Stack, useFocusEffect } from 'expo-router';
import type { AndroidSymbol } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Card, Empty, Icon, Txt } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { occurrences, fmtMoney, type Booking, type Payment } from '@/lib/business';
import { listTime, type Chat, type ChatMember } from '@/lib/chat';
import { addDays, dayKey } from '@/lib/dates';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

type Item = { key: string; icon: AndroidSymbol; title: string; sub: string; at: string; href: () => void; color?: string };

/** Everything new in one list: messages, finished workouts, bookings, payments, today's sessions */
export default function Notifications() {
  const p = usePalette();
  const app = useApp();
  const me = app.user?.id ?? '';
  const [items, setItems] = useState<Item[] | null>(null);
  const load = useCallback(async () => {
    const week = addDays(new Date(), -7).toISOString();
    const [chats, mem, clients, logs, books, pays, sign] = await Promise.all([
      sb.from('coach_chats').select('*').gte('last_message_at', week),
      sb.from('coach_chat_members').select('*'),
      sb.from('coach_clients').select('id, name, first_name'),
      sb.from('coach_logs').select('id, client_id, assignment_id, performed_at, rpe').gte('performed_at', week).order('performed_at', { ascending: false }).limit(50),
      sb.from('coach_bookings').select('*'),
      sb.from('coach_payments').select('*').gte('paid_at', week).order('paid_at', { ascending: false }).limit(30),
      sb.from('coach_event_signups').select('event_id, client_id, status, created_at, coach_events(title)').gte('created_at', week).limit(30),
    ]);
    const name = (id: string | null) => ((clients.data ?? []) as { id: string; name: string }[]).find((c) => c.id === id)?.name ?? 'A client';
    const members = (mem.data as ChatMember[]) ?? [];
    const out: Item[] = [];
    for (const c of (chats.data as Chat[]) ?? []) {
      const mine = members.find((m) => m.chat_id === c.id && m.user_id === me);
      if (!mine || mine.muted || !c.last_message_at || c.last_message_at <= mine.last_read_at) continue;
      const who = c.kind === 'group' ? c.title ?? 'Group chat' : members.find((m) => m.chat_id === c.id && m.user_id !== me)?.name ?? 'Chat';
      out.push({ key: `c${c.id}`, icon: 'chat_bubble', title: `New message from ${who}`, sub: c.last_preview ?? '', at: c.last_message_at, href: () => router.push({ pathname: '/chat/[id]', params: { id: c.id } }), color: p.focus });
    }
    if (app.mode === 'coach') {
      for (const l of (logs.data ?? []) as { id: string; client_id: string; assignment_id: string | null; performed_at: string; rpe: number | null }[])
        out.push({ key: `l${l.id}`, icon: 'fitness_center', title: `${name(l.client_id)} finished a workout`, sub: l.rpe ? `Effort ${l.rpe}/10` : 'Tap to see what they did', at: l.performed_at,
          href: () => (l.assignment_id ? router.push({ pathname: '/workout/[aid]', params: { aid: l.assignment_id } }) : router.push({ pathname: '/clients/[id]/workouts', params: { id: l.client_id } })), color: p.good });
      for (const b of ((books.data as (Booking & { created_at: string })[]) ?? []).filter((x) => x.booked_by === 'client' && x.created_at >= week))
        out.push({ key: `b${b.id}`, icon: 'event', title: `${name(b.client_id)} booked a session`, sub: new Date(b.starts_at).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' }), at: b.created_at, href: () => router.push('/calendar') });
      for (const x of (pays.data as Payment[]) ?? [])
        out.push({ key: `p${x.id}`, icon: 'payments', title: `${fmtMoney(x.amount_cents, x.currency)} from ${name(x.client_id)}`, sub: x.description, at: x.paid_at, href: () => router.push('/financials'), color: p.gold });
      for (const s of (sign.data ?? []) as unknown as { event_id: string; client_id: string; status: string; created_at: string; coach_events: { title: string } | null }[])
        out.push({ key: `e${s.event_id}${s.client_id}`, icon: 'event_available', title: `${name(s.client_id)} ${s.status === 'waitlist' ? 'joined the waiting list for' : s.status === 'cancelled' ? 'dropped out of' : 'signed up for'} ${s.coach_events?.title ?? 'an event'}`, sub: '', at: s.created_at, href: () => router.push({ pathname: '/events/[id]', params: { id: s.event_id } }) });
    }
    const today = dayKey(new Date());
    for (const o of occurrences((books.data as Booking[]) ?? [], today, today).filter((x) => x.end.getTime() > Date.now()))
      out.push({ key: `t${o.booking.id}`, icon: 'schedule', title: `Today ${o.start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}: ${o.booking.title}`, sub: o.booking.location ?? '', at: new Date().toISOString(), href: () => router.push('/calendar'), color: p.gold });
    setItems(out.sort((a, b) => b.at.localeCompare(a.at)));
  }, [me, app.mode, p.focus, p.good, p.gold]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: MAX_W, gap: 12 }}>
          {items === null ? <ActivityIndicator color={p.ink} /> : items.length === 0 ? <Empty emoji="🔔" title="All caught up" body="New messages, finished workouts, bookings and payments from the last week show here." /> : (
            <Card style={{ padding: 0 }}>
              {items.map((x, i) => (
                <Pressable key={x.key} onPress={x.href} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.75 : 1 })}>
                  <Icon name={x.icon} color={x.color ?? p.ink} />
                  <View style={{ flex: 1 }}><Txt v="bold">{x.title}</Txt>{x.sub ? <Txt v="small" numberOfLines={1}>{x.sub}</Txt> : null}</View>
                  <Txt v="small">{x.key.startsWith('t') ? '' : listTime(x.at)}</Txt>
                </Pressable>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
