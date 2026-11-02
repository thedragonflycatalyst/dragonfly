import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';
import { F, R } from '@/lib/theme';
import { coverColors } from '@/lib/workouts';
import { Txt } from './ui';

// Signed links for uploaded covers, shared across the app for an hour
const cache = new Map<string, { url: string; until: number }>();
export async function coverUrl(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data } = await sb.storage.from('coach-media').createSignedUrl(path, 3600);
  if (data?.signedUrl) cache.set(path, { url: data.signedUrl, until: Date.now() + 3_300_000 });
  return data?.signedUrl ?? null;
}
export const isUploaded = (cover: string | null | undefined): cover is string => !!cover?.startsWith('media:');

/** Cover art: the trainer's own uploaded image, or a gradient with the item's initials */
export function Cover({ name, cover, size = 64 }: { name: string; cover: string | null; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (isUploaded(cover)) coverUrl(cover.slice(6)).then(setUrl); else setUrl(null); }, [cover]);
  if (isUploaded(cover)) {
    return <Image source={url ? { uri: url } : null} accessibilityLabel={`${name} cover`} contentFit="cover"
      style={{ width: size, height: size, borderRadius: R.sm, backgroundColor: '#8884' }} />;
  }
  const [a, b] = coverColors(cover, name);
  const letters = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' }}>
      <Txt style={{ fontFamily: F.display, fontSize: size * 0.34, color: '#fff' }}>{letters}</Txt>
    </LinearGradient>
  );
}
