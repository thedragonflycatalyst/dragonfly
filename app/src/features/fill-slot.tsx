// Fill this slot: rank the client pool for an open time, send one offer to the chosen clients, first to accept gets it.
// Until automatic texting is switched on, each offer is sent from the trainer's phone (Messages / WhatsApp) with a link.
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, Txt, useToast } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { offerExpiry, offerText, rankPool, tierLabel, type PoolClient, type Ranked, type Window } from '@/lib/client-pool';
import { contactLink } from '@/lib/contact';
import { errText } from '@/lib/model';
import { sb, WEB_URL } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

export type OpenSlot = { start: Date; durationMin: number; title: string; location: string | null; bookingId: string | null };
type Sent = { client: PoolClient; token: string; texted: boolean };

/** Load everything the ranking needs for this trainer */
export async function loadPool(trainerId: string) {
  const [c, w, seen, pk] = await Promise.all([
    sb.from('coach_clients').select('id, name, first_name, status, frequency_tier, short_notice_ok, client_of, phone').eq('trainer_id', trainerId),
    sb.from('coach_client_availability').select('client_id, weekday, start_time, end_time'),
    sb.rpc('coach_client_last_seen'),
    sb.from('coach_client_packages').select('client_id, credits_total, credits_used, status').eq('trainer_id', trainerId).eq('status', 'active'),
  ]);
  if (c.error) throw c.error;
  const lastSeen: Record<string, string | null> = {};
  for (const r of (seen.data as { client_id: string; last_at: string | null }[] | null) ?? []) lastSeen[r.client_id] = r.last_at;
  const credits: Record<string, number | null> = {};
  for (const r of (pk.data as { client_id: string; credits_total: number | null; credits_used: number }[] | null) ?? []) {
    if (r.credits_total == null) continue;
    credits[r.client_id] = (credits[r.client_id] ?? 0) + Math.max(0, r.credits_total - r.credits_used);
  }
  return { clients: (c.data as (PoolClient & { first_name: string })[]) ?? [], windows: (w.data as Window[]) ?? [], lastSeen, credits };
}

export function FillSlotSheet({ slot, onClose, busyClients }: { slot: OpenSlot | null; onClose: () => void; busyClients?: Set<string> }) {
  const p = usePalette();
  const app = useApp();
  const toast = useToast();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadPool>> | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [regulars, setRegulars] = useState(false);
  const [ca, setCa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent[] | null>(null);
  const trainerId = app.trainer?.user_id;

  useEffect(() => {
    if (!slot || !trainerId) return;
    setData(null); setSent(null); setPicked(new Set());
    loadPool(trainerId).then(setData, (e: unknown) => toast(errText(e), false));
  }, [slot, trainerId, toast]);

  const ranked: Ranked[] = useMemo(() => {
    if (!data || !slot) return [];
    const list = rankPool({ ...data, start: slot.start, durationMin: slot.durationMin, now: new Date(), busy: busyClients, includeRegulars: regulars });
    // Columbia Association clients are left out unless the trainer includes them (owner decision pending)
    return ca ? list : list.filter((r) => r.client.client_of !== 'ca');
  }, [data, slot, busyClients, regulars, ca]);
  // Pre-pick the top three who are free then
  useEffect(() => { if (ranked.length && !picked.size && !sent) setPicked(new Set(ranked.filter((r) => r.fits).slice(0, 3).map((r) => r.client.id))); }, [ranked]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const send = async () => {
    if (!slot || !trainerId || !picked.size) return;
    setBusy(true);
    try {
      const { data: offer, error } = await sb.from('coach_slot_offers').insert({
        booking_id: slot.bookingId, starts_at: slot.start.toISOString(), duration_min: slot.durationMin, title: slot.title.slice(0, 120),
        location: slot.location, expires_at: offerExpiry(slot.start, new Date()).toISOString(),
      }).select('id').single();
      if (error) throw error;
      const { data: rows, error: e2 } = await sb.from('coach_slot_offer_recipients').insert([...picked].map((client_id) => ({ offer_id: offer.id, client_id }))).select('client_id, token');
      if (e2) throw e2;
      const byId = new Map((data?.clients ?? []).map((c) => [c.id, c]));
      setSent(((rows as { client_id: string; token: string }[]) ?? []).flatMap((r) => { const c = byId.get(r.client_id); return c ? [{ client: c, token: r.token, texted: false }] : []; }));
    } catch (e) { toast(errText(e), false); } finally { setBusy(false); }
  };
  const textOne = async (s: Sent) => {
    if (!slot) return;
    const first = (s.client as PoolClient & { first_name?: string }).first_name ?? s.client.name.split(' ')[0];
    const msg = offerText(first, app.trainer?.display_name ?? 'your trainer', slot.start, `${WEB_URL}o/${s.token}`);
    const link = contactLink('sms', s.client.phone, msg, Platform.OS);
    if (!link) return toast(`${s.client.name} has no mobile number saved`, false);
    await Linking.openURL(link);
    await sb.from('coach_slot_offer_recipients').update({ sent_at: new Date().toISOString(), channel: 'sms' }).eq('token', s.token);
    setSent((all) => all?.map((x) => (x.token === s.token ? { ...x, texted: true } : x)) ?? null);
  };

  const when = slot?.start.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <Sheet visible={!!slot} onClose={onClose} title={`Fill ${when ?? 'this slot'}`} full>
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
        {sent ? (
          <>
            <Txt>Offer ready. Text each person; the first to tap the link gets the session and it goes on your calendar.</Txt>
            {sent.map((s) => (
              <Card key={s.token} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Txt v="bold" style={{ flex: 1 }}>{s.client.name}</Txt>
                <Button small kind={s.texted ? 'ghost' : 'solid'} icon="sms" title={s.texted ? 'Texted' : 'Text offer'} onPress={() => textOne(s)} />
              </Card>
            ))}
            <Button kind="ghost" title="Done" onPress={onClose} />
          </>
        ) : !data ? <Txt>Loading your clients…</Txt> : (
          <>
            <Txt v="small">Best matches first: free at that time, wants short-notice offers, longest since their last session, credits left.</Txt>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Chip label="Include regulars" selected={regulars} onPress={() => setRegulars(!regulars)} />
              <Chip label="Include Columbia Association clients" selected={ca} onPress={() => setCa(!ca)} />
            </View>
            {ranked.length === 0 && <Txt>No one on your roster fits this time. Set clients’ tiers and free times on their profiles.</Txt>}
            {ranked.map((r) => (
              <Card key={r.client.id} style={{ gap: 4, borderWidth: picked.has(r.client.id) ? 1.5 : 0, borderColor: p.focus }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Txt v="bold" style={{ flex: 1 }}>{r.client.name}</Txt>
                  <Txt v="small">{tierLabel(r.tier)}</Txt>
                  <Button small kind={picked.has(r.client.id) ? 'solid' : 'ghost'} title={picked.has(r.client.id) ? 'Picked' : 'Pick'} onPress={() => toggle(r.client.id)} />
                </View>
                <Txt v="small">{r.why.join(' · ')}</Txt>
              </Card>
            ))}
            <Button title={`Send offer to ${picked.size} ${picked.size === 1 ? 'person' : 'people'}`} disabled={!picked.size} busy={busy} onPress={send} />
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}
