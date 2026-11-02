import type { AndroidSymbol } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { errText, type Client, type Group } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { F, R, usePalette } from '@/lib/theme';
import { Initials } from './bits';
import { Sheet } from './sheet';
import { Button, Field, Icon, Txt, useToast } from './ui';

/** Rounded search input */
export function SearchBox({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, height: 46 }}>
      <Icon name="search" size={20} color={p.muted} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={p.muted} accessibilityLabel={placeholder}
        style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: p.ink, height: 44 }} />
      {value ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} hitSlop={8}><Icon name="close" size={18} color={p.muted} /></Pressable> : null}
    </View>
  );
}
export const matches = (q: string, ...hay: (string | null | undefined)[]) => {
  const h = hay.filter(Boolean).join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => h.includes(w));
};

/** The big floating button at the bottom of a list screen */
export function Fab({ title, icon = 'add', onPress }: { title: string; icon?: AndroidSymbol; onPress: () => void }) {
  return (
    <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
      <Button kind="accent" icon={icon} title={title} onPress={onPress} />
    </View>
  );
}

/** A labelled on/off row */
export function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <View style={{ flex: 1 }}>
        <Txt v="bold">{label}</Txt>
        {sub ? <Txt v="small">{sub}</Txt> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: p.focus, false: p.line }} thumbColor={p.surface} />
    </View>
  );
}

/** HH:MM time box. Accepts "7:30", "19:30" or "7:30 pm"; only valid times are passed on. */
/** "7:30 PM" from "19:30" */
export const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return hhmm;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** A time picked with taps (hour, minutes, AM/PM): shown in 12-hour time, stored as "HH:MM" */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const [h24, m] = (/^\d{1,2}:\d{2}/.test(value) ? value : '09:00').split(':').map(Number);
  const pm = h24 >= 12, h12 = h24 % 12 || 12;
  const set = (hh: number, mm: number, isPm: boolean) => onChange(`${String((hh % 12) + (isPm ? 12 : 0)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  const cell = (on: boolean) => ({ minWidth: 52, height: 42, borderRadius: R.md, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: on ? p.focus : p.soft, borderWidth: 1, borderColor: on ? p.focus : p.line });
  return (
    <View style={{ marginBottom: 16 }}>
      <Txt v="bold" style={{ marginBottom: 6, fontSize: 14 }}>{label}</Txt>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${time12(value)}. Change`} onPress={() => setOpen(true)}
        style={{ minHeight: 46, borderWidth: 1, borderColor: p.line, borderRadius: R.md, backgroundColor: p.raise, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="schedule" size={20} color={p.focus} /><Txt style={{ flex: 1 }}>{time12(value)}</Txt><Icon name="expand_more" size={20} color={p.muted} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <Txt v="h1" center style={{ marginBottom: 14 }}>{time12(value)}</Txt>
        <Txt v="smallBold" style={{ marginBottom: 6 }}>Hour</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hh) => (
            <Pressable key={hh} accessibilityRole="button" accessibilityState={{ selected: hh === h12 }} onPress={() => set(hh, m, pm)} style={cell(hh === h12)}>
              <Txt v="bold" color={hh === h12 ? p.onAccent : p.ink}>{hh}</Txt>
            </Pressable>
          ))}
        </View>
        <Txt v="smallBold" style={{ marginBottom: 6 }}>Minutes</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((mm) => (
            <Pressable key={mm} accessibilityRole="button" accessibilityState={{ selected: mm === m }} onPress={() => set(h12, mm, pm)} style={cell(mm === m)}>
              <Txt v="bold" color={mm === m ? p.onAccent : p.ink}>:{String(mm).padStart(2, '0')}</Txt>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {([false, true] as const).map((x) => (
            <Pressable key={String(x)} accessibilityRole="button" accessibilityState={{ selected: pm === x }} onPress={() => set(h12, m, x)} style={[cell(pm === x), { flex: 1 }]}>
              <Txt v="bold" color={pm === x ? p.onAccent : p.ink}>{x ? 'PM' : 'AM'}</Txt>
            </Pressable>
          ))}
        </View>
        <Button title="Done" onPress={() => setOpen(false)} />
      </Sheet>
    </View>
  );
}

/** Swatches */
export function ColorPicker({ value, onChange, colors }: { value: string | null; onChange: (c: string) => void; colors: string[] }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {colors.map((c) => (
        <Pressable key={c} accessibilityRole="radio" accessibilityState={{ selected: value === c }} accessibilityLabel={`Colour ${c}`} onPress={() => onChange(c)}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c, borderWidth: 3, borderColor: value === c ? p.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {value === c ? <Icon name="check" size={18} color="#fff" /> : null}
        </Pressable>
      ))}
    </View>
  );
}

/** Pick one emoji as an icon */
export function EmojiPicker({ value, onChange, options }: { value: string; onChange: (e: string) => void; options: string[] }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((e) => (
        <Pressable key={e} accessibilityRole="radio" accessibilityState={{ selected: value === e }} accessibilityLabel={e} onPress={() => onChange(e)}
          style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: value === e ? p.soft : 'transparent', borderWidth: 1.5, borderColor: value === e ? p.focus : 'transparent' }}>
          <Text style={{ fontSize: 24 }}>{e}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** The trainer's clients (not archived), loaded once */
export function useClientList() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [groups, setGroups] = useState<(Group & { members: string[] })[]>([]);
  const load = useCallback(async () => {
    const [c, g, gm] = await Promise.all([
      sb.from('coach_clients').select('*').neq('status', 'archived').order('first_name'),
      sb.from('coach_groups').select('*').order('name'),
      sb.from('coach_group_members').select('group_id, client_id'),
    ]);
    setClients((c.data as Client[]) ?? []);
    const mem = (gm.data ?? []) as { group_id: string; client_id: string }[];
    setGroups(((g.data as Group[]) ?? []).map((x) => ({ ...x, members: mem.filter((m) => m.group_id === x.id).map((m) => m.client_id) })));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { clients, groups, reload: load };
}

/** Sheet to choose clients (and whole groups) */
export function ClientPicker({ visible, onClose, title = 'Choose clients', value, onDone, single, onlyLinked, footer }: {
  visible: boolean; onClose: () => void; title?: string; value: string[]; onDone: (ids: string[]) => void; single?: boolean; onlyLinked?: boolean; footer?: ReactNode;
}) {
  const p = usePalette();
  const toast = useToast();
  const { clients, groups } = useClientList();
  const [sel, setSel] = useState<string[]>(value);
  const [q, setQ] = useState('');
  useEffect(() => { if (visible) { setSel(value); setQ(''); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => (clients ?? []).filter((c) => (!onlyLinked || c.user_id) && matches(q, c.name, c.email)), [clients, q, onlyLinked]);
  const flip = (id: string) => {
    if (single) { onDone([id]); onClose(); return; }
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: 10 }}>
        <SearchBox value={q} onChange={setQ} placeholder="Search clients" />
        {!single && groups.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {groups.map((g) => (
              <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`Add group ${g.name}`} onPress={() => setSel((s) => [...new Set([...s, ...g.members])])}
                style={{ paddingHorizontal: 12, height: 34, borderRadius: R.pill, borderWidth: 1, borderColor: p.line, justifyContent: 'center' }}>
                <Txt v="small" color={p.ink}>+ {g.name}</Txt>
              </Pressable>
            ))}
          </View>
        )}
        {clients === null ? <ActivityIndicator color={p.ink} /> : list.length === 0 ? <Txt v="small">{onlyLinked ? 'No clients with the app yet. Clients appear once they’ve signed in.' : 'No clients found.'}</Txt> : (
          list.map((c) => {
            const on = sel.includes(c.id);
            return (
              <Pressable key={c.id} accessibilityRole={single ? 'button' : 'checkbox'} accessibilityState={{ checked: on }} accessibilityLabel={c.name} onPress={() => flip(c.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                <Initials name={c.name} size={36} />
                <View style={{ flex: 1 }}><Txt v="bold">{c.name}</Txt>{!c.user_id ? <Txt v="small">Hasn’t signed in yet</Txt> : null}</View>
                {!single && <Icon name={on ? 'check_box' as AndroidSymbol : 'check_box_outline_blank' as AndroidSymbol} size={24} color={on ? p.focus : p.muted} />}
              </Pressable>
            );
          })
        )}
        {footer}
        {!single && <Button title={sel.length ? `Done · ${sel.length} chosen` : 'Done'} onPress={() => { try { onDone(sel); onClose(); } catch (e) { toast(errText(e), false); } }} />}
      </View>
    </Sheet>
  );
}

/** Small round count / label on the right of a row */
export function Pill({ text, color }: { text: string; color?: string }) {
  const p = usePalette();
  return <View style={{ backgroundColor: color ?? p.focus, borderRadius: R.pill, minWidth: 22, height: 22, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: p.onAccent }}>{text}</Text>
  </View>;
}
