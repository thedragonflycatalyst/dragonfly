// "Post it there too": the trainer's review sites (Google, Facebook, …) on the testimonial and survey pages.
// The client's words are copied first so they can paste them; we keep our own copy either way.
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { Button, Txt } from '@/components/ui';
import { sb } from '@/lib/supabase';

type Site = { platform: string; label: string; url: string };

export function ReviewSites({ token, text, record }: { token: string; text?: string | null; record?: boolean }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => { void sb.rpc('coach_review_links_for', { p_token: token }).then(({ data }) => setSites((data as Site[] | null) ?? [])); }, [token]);
  if (!sites.length) return null;
  const go = async (s: Site) => {
    if (text?.trim()) { try { await Clipboard.setStringAsync(text.trim()); setCopied(true); } catch { /* copying is a convenience */ } }
    if (record) void sb.rpc('coach_testimonial_shared', { p_token: token, p_platform: s.platform });
    await Linking.openURL(s.url);
  };
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Txt v="bold">Would you post a review there too?</Txt>
      <Txt v="small">{text?.trim() ? 'Tap a site: your words are copied so you can paste them in.' : 'It helps other people find good training.'} Entirely optional.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {sites.map((s) => <Button key={s.url} small kind="ghost" title={s.label} onPress={() => go(s)} />)}
      </View>
      {copied && <Txt v="small">Copied. Paste it into the review box.</Txt>}
    </View>
  );
}
