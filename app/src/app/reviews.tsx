// Reviews: client testimonials (published to the website only after the client approves), survey answers and referrals.
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Segmented } from '@/components/bits';
import { Button, Card, Field, Txt, useToast } from '@/components/ui';
import { errText } from '@/lib/model';
import { sb } from '@/lib/supabase';
import { MAX_W, usePalette } from '@/lib/theme';

type T = { id: string; body: string | null; display_name: string | null; status: string; hidden_reason: string | null; created_at: string; published_at: string | null; coach_clients: { name: string } | null };
type S = { id: string; rating: number | null; comment: string | null; created_at: string; coach_clients: { name: string } | null };
type R = { id: string; name: string; email: string | null; phone: string | null; message: string | null; status: string; created_at: string; coach_referrals: { coach_clients: { name: string } | null } | null };
const STATUS: Record<string, string> = { draft: 'Waiting for the client', published: 'On your website', withdrawn: 'Withdrawn by the client', hidden: 'Hidden by you' };

export default function Reviews() {
  const p = usePalette();
  const toast = useToast();
  const [tab, setTab] = useState<'testimonials' | 'surveys' | 'referrals'>('testimonials');
  const [ts, setTs] = useState<T[]>([]);
  const [ss, setSs] = useState<S[]>([]);
  const [rs, setRs] = useState<R[]>([]);
  const [hiding, setHiding] = useState<{ id: string; reason: string } | null>(null);
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      sb.from('coach_testimonials').select('id, body, display_name, status, hidden_reason, created_at, published_at, coach_clients(name)').order('created_at', { ascending: false }).limit(200),
      sb.from('coach_survey_responses').select('id, rating, comment, created_at, coach_clients(name)').order('created_at', { ascending: false }).limit(200),
      sb.from('coach_referral_signups').select('id, name, email, phone, message, status, created_at, coach_referrals(coach_clients(name))').order('created_at', { ascending: false }).limit(200),
    ]);
    setTs((a.data as unknown as T[]) ?? []); setSs((b.data as unknown as S[]) ?? []); setRs((c.data as unknown as R[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const setStatus = async (id: string, status: 'hidden' | 'published', hidden_reason?: string) => {
    const { error } = await sb.from('coach_testimonials').update({ status, hidden_reason: hidden_reason ?? null }).eq('id', id);
    if (error) toast(errText(error), false); else { setHiding(null); void load(); }
  };
  const referral = async (id: string, status: string) => {
    const { error } = await sb.from('coach_referral_signups').update({ status }).eq('id', id);
    if (error) toast(errText(error), false); else void load();
  };
  const rated = ss.filter((x) => x.rating);
  const avg = rated.length ? (rated.reduce((t, x) => t + (x.rating ?? 0), 0) / rated.length).toFixed(1) : null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
      <Stack.Screen options={{ title: 'Reviews' }} />
      <View style={{ width: '100%', maxWidth: MAX_W, gap: 10 }}>
        <Segmented value={tab} onChange={setTab} options={[['testimonials', 'Testimonials'], ['surveys', 'Surveys'], ['referrals', 'Referrals']]} />
        {tab === 'testimonials' && (<>
          <Txt v="small">Clients write and approve their own words; you can hide one from your website with a reason. The website labels these “Client testimonials”.</Txt>
          {ts.length === 0 && <Txt>No testimonials yet. Turn on testimonial asks in Settings → Automatic messages.</Txt>}
          {ts.map((t) => (
            <Card key={t.id} style={{ gap: 6 }}>
              <Txt v="smallBold" color={t.status === 'published' ? p.good : p.focus}>{STATUS[t.status] ?? t.status} · {t.coach_clients?.name ?? ''}</Txt>
              {t.body ? <Txt>“{t.body}”{t.display_name ? ` — ${t.display_name}` : ''}</Txt> : <Txt v="small">No words yet.</Txt>}
              {t.status === 'hidden' && t.hidden_reason ? <Txt v="small">Hidden because: {t.hidden_reason}</Txt> : null}
              {t.status === 'published' && (hiding?.id === t.id ? (
                <View style={{ gap: 6 }}>
                  <Field label="Why hide it?" value={hiding.reason} onChangeText={(reason) => setHiding({ id: t.id, reason })} />
                  <Button small title="Hide from website" disabled={!hiding.reason.trim()} onPress={() => setStatus(t.id, 'hidden', hiding.reason.trim())} />
                </View>
              ) : <Button small kind="ghost" title="Hide…" onPress={() => setHiding({ id: t.id, reason: '' })} style={{ alignSelf: 'flex-start' }} />)}
              {t.status === 'hidden' && <Button small kind="ghost" title="Show again" onPress={() => setStatus(t.id, 'published')} style={{ alignSelf: 'flex-start' }} />}
            </Card>
          ))}
        </>)}
        {tab === 'surveys' && (<>
          <Txt v="small">{avg ? `Average ${avg} out of 5 from ${rated.length} answer${rated.length === 1 ? '' : 's'}.` : 'No answers yet.'}</Txt>
          {ss.map((s) => (
            <Card key={s.id} style={{ gap: 4 }}>
              <Txt v="bold">{s.rating ? `${s.rating}/5` : 'No rating'} · {s.coach_clients?.name ?? ''} · {new Date(s.created_at).toLocaleDateString()}</Txt>
              {s.comment ? <Txt>“{s.comment}”</Txt> : null}
            </Card>
          ))}
        </>)}
        {tab === 'referrals' && (<>
          {rs.length === 0 && <Txt>No referrals yet. Clients can share their link from their app (Me → Refer a friend).</Txt>}
          {rs.map((r) => (
            <Card key={r.id} style={{ gap: 4 }}>
              <Txt v="bold">{r.name} · referred by {r.coach_referrals?.coach_clients?.name ?? 'a client'}</Txt>
              <Txt v="small">{[r.email, r.phone, new Date(r.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}</Txt>
              {r.message ? <Txt>“{r.message}”</Txt> : null}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {['new', 'contacted', 'joined', 'declined'].map((st) => <Button key={st} small kind={r.status === st ? 'solid' : 'ghost'} title={st[0].toUpperCase() + st.slice(1)} onPress={() => referral(r.id, st)} />)}
              </View>
            </Card>
          ))}
        </>)}
      </View>
    </ScrollView>
  );
}
