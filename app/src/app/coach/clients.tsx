import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Initials, Row, Segmented, statusColor } from '@/components/bits';
import { Badge, Screen } from '@/components/shell';
import { Button, Card, Chip, Empty, Field, Icon, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { errText, STATUS_LABEL, type Client, type Group } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { F, R, usePalette } from '@/lib/theme';

type Tab = 'clients' | 'groups' | 'pool';
type Sort = 'az' | 'za' | 'newest' | 'oldest';
type Show = 'current' | 'active' | 'invited' | 'frozen' | 'archived';
const SORTS: [Sort, string][] = [['az', 'A to Z'], ['za', 'Z to A'], ['newest', 'Newest'], ['oldest', 'Oldest']];
const SHOWS: [Show, string][] = [['current', 'All current'], ['active', 'Active'], ['invited', 'Invited'], ['frozen', 'Frozen'], ['archived', 'Archived']];

/** Trainer's Clients tab: client list, groups and the client pool (leads not invited yet). */
export default function Clients() {
  const p = usePalette();
  const toast = useToast();
  const app = useApp();
  const [tab, setTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<Client[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<{ group_id: string; client_id: string }[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('az');
  const [show, setShow] = useState<Show>('current');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [c, g, m] = await Promise.all([
      sb.from('coach_clients').select('*'),
      sb.from('coach_groups').select('*').order('name'),
      sb.from('coach_group_members').select('group_id,client_id'),
    ]);
    if (c.error) toast(errText(c.error), false);
    setClients((c.data as Client[]) ?? []); setGroups((g.data as Group[]) ?? []); setMembers(m.data ?? []);
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const inGroup = groupFilter ? new Set(members.filter((m) => m.group_id === groupFilter).map((m) => m.client_id)) : null;
    const rows = (clients ?? []).filter((c) => {
      if (tab === 'pool' ? c.status !== 'lead' : c.status === 'lead') return false;
      if (tab === 'clients') {
        if (show === 'current' ? c.status === 'archived' : c.status !== show) return false;
        if (inGroup && !inGroup.has(c.id)) return false;
      }
      return !needle || c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle) || (c.phone ?? '').includes(needle);
    });
    const byName = (a: Client, b: Client) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
    rows.sort((a, b) => sort === 'az' ? byName(a, b) : sort === 'za' ? byName(b, a)
      : sort === 'newest' ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at));
    return rows;
  }, [clients, members, tab, q, sort, show, groupFilter]);

  const counts = useMemo(() => {
    const all = clients ?? [];
    return { current: all.filter((c) => c.status !== 'lead' && c.status !== 'archived').length, pool: all.filter((c) => c.status === 'lead').length };
  }, [clients]);

  const addGroup = async () => {
    if (!newGroup.trim()) return;
    const { error } = await sb.from('coach_groups').insert({ trainer_id: app.trainer!.user_id, name: newGroup.trim() });
    if (error) return toast(errText(error), false);
    setNewGroup(''); toast('Group created'); load();
  };
  const activeFilters = (show !== 'current' ? 1 : 0) + (groupFilter ? 1 : 0);

  return (
    <Screen kicker={app.trainer?.business_name ?? 'Coaching'} title="Clients"
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}
      right={tab !== 'groups' && <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {tab !== 'pool' && <Button kind="ghost" title="QR sign-up" icon="qr_code_2" onPress={() => router.push('/join-qr')} />}
        <Button title={tab === 'pool' ? 'Add to pool' : 'Add client'} icon="person_add"
          onPress={() => router.push({ pathname: '/clients/new', params: tab === 'pool' ? { pool: '1' } : {} })} />
      </View>}>
      <Segmented value={tab} onChange={setTab} options={[['clients', `Clients (${counts.current})`], ['groups', 'Groups'], ['pool', `Client pool (${counts.pool})`]]} />

      {tab !== 'groups' && (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'center' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: R.pill, paddingHorizontal: 14, height: 46 }}>
            <Icon name="search" size={20} color={p.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search name, email or phone" placeholderTextColor={p.muted} accessibilityLabel="Search clients"
              autoCapitalize="none" autoCorrect={false} style={{ flex: 1, fontFamily: F.body, fontSize: 16, color: p.ink, height: 44 }} />
            {q ? <Pressable accessibilityLabel="Clear search" onPress={() => setQ('')} hitSlop={8}><Icon name="close" size={18} color={p.muted} /></Pressable> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Sort and filter${activeFilters ? `, ${activeFilters} filters on` : ''}`} onPress={() => setFiltersOpen((o) => !o)}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: filtersOpen || activeFilters ? p.ink : p.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="filter_list" size={22} color={filtersOpen || activeFilters ? p.bg : p.ink} />
          </Pressable>
        </View>
      )}

      {tab !== 'groups' && filtersOpen && (
        <Card style={{ marginTop: 12, gap: 10 }}>
          <Txt v="smallBold">Sort</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{SORTS.map(([k, l]) => <Chip key={k} label={l} selected={sort === k} onPress={() => setSort(k)} />)}</View>
          {tab === 'clients' && (
            <>
              <Txt v="smallBold" style={{ marginTop: 4 }}>Show</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{SHOWS.map(([k, l]) => <Chip key={k} label={l} selected={show === k} onPress={() => setShow(k)} />)}</View>
              {groups.length > 0 && (
                <>
                  <Txt v="smallBold" style={{ marginTop: 4 }}>Group</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Chip label="Any" selected={!groupFilter} onPress={() => setGroupFilter(null)} />
                    {groups.map((g) => <Chip key={g.id} label={g.name} selected={groupFilter === g.id} onPress={() => setGroupFilter(g.id)} />)}
                  </View>
                </>
              )}
            </>
          )}
        </Card>
      )}

      <View style={{ marginTop: 16 }}>
        {clients === null ? <ActivityIndicator color={p.ink} style={{ marginTop: 40 }} /> : tab === 'groups' ? (
          <>
            <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 14 }}>
              <View style={{ flex: 1 }}><Field label="New group" value={newGroup} onChangeText={setNewGroup} placeholder="Morning bootcamp" onSubmitEditing={addGroup} style={{ marginBottom: 0 }} /></View>
              <Button title="Create" onPress={addGroup} style={{ marginBottom: 16 }} />
            </Card>
            {groups.length === 0 ? <Empty emoji="🪷" title="No groups yet" body="Groups let you organize clients, like a class, a team or a challenge. Assigning work to a whole group comes with the Workouts tab." /> : (
              <Card style={{ padding: 0 }}>
                {groups.map((g, i) => (
                  <Row key={g.id} icon="groups" title={g.name} last={i === groups.length - 1}
                    sub={`${members.filter((m) => m.group_id === g.id).length} clients`} onPress={() => router.push({ pathname: '/groups/[id]', params: { id: g.id } })} />
                ))}
              </Card>
            )}
          </>
        ) : list.length === 0 ? (
          (clients ?? []).length === 0 && tab === 'clients'
            ? <Empty emoji="🪽" title="Add your first client" body="Add a client by email. They get a code to set their password and see everything you assign in their app."
                action={<Button title="Add client" icon="person_add" onPress={() => router.push('/clients/new')} />} />
            : tab === 'pool' && !q
              ? <Empty emoji="🌱" title="Your client pool is empty" body="Keep prospective clients here, like people who asked about training. When they’re ready, send them an invite in one tap." />
              : <Txt v="small" center style={{ marginTop: 24 }}>No clients match.</Txt>
        ) : (
          <Card style={{ padding: 0 }}>
            {list.map((c, i) => (
              <Pressable key={c.id} accessibilityRole="link" accessibilityLabel={`${c.name}, ${STATUS_LABEL[c.status]}`}
                onPress={() => router.push({ pathname: '/clients/[id]', params: { id: c.id } })}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: p.line, opacity: pressed ? 0.7 : 1 })}>
                <Initials name={c.name} size={42} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="bold" numberOfLines={1}>{c.name}</Txt>
                  <Txt v="small" numberOfLines={1}>{tab === 'pool' ? [c.source, c.email].filter(Boolean).join(' · ') : c.email}</Txt>
                </View>
                {c.status !== 'active' && tab !== 'pool' && <Badge text={STATUS_LABEL[c.status]} color={statusColor(c.status, p)} />}
                <Icon name="chevron_right" size={20} color={p.muted} />
              </Pressable>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
