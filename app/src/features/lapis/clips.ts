// Lapis studio-voice lines ("Rest", "3", "2", "1"...), fetched from the Lapis voice service once and kept on the phone,
// so cues play instantly and offline after the first time. Lapis has these words pre-recorded for every voice.
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase';

const ENDPOINT = `${SUPABASE_URL}/functions/v1/lapis-tts`;
const web = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

async function fetchClip(text: string, voice: string, rate: number): Promise<ArrayBuffer | null> {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text, voice, rate }),
  });
  if (!r.ok || !(r.headers.get('content-type') ?? '').includes('audio')) return null;
  return r.arrayBuffer();
}

/** A playable file for one spoken line, or null when it can't be had right now */
export function clip(text: string, voice: string, rate = 1): Promise<string | null> {
  const id = `v2|${voice}|${rate.toFixed(2)}|${text.trim()}`;
  let p = inFlight.get(id);
  if (p) return p;
  p = (async () => {
    try {
      if (Platform.OS === 'web') {
        const hit = web.get(id);
        if (hit) return hit;
        const buf = await fetchClip(text, voice, rate);
        if (!buf) return null;
        const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
        web.set(id, url);
        return url;
      }
      const name = `${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, id)}.mp3`;
      const dir = new Directory(Paths.cache, 'lapis');
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const f = new File(dir, name);
      if (f.exists && (f.size ?? 0) > 0) return f.uri;
      const buf = await fetchClip(text, voice, rate);
      if (!buf) return null;
      await f.write(new Uint8Array(buf));
      return f.uri;
    } catch { return null; } finally { inFlight.delete(id); }
  })();
  inFlight.set(id, p);
  return p;
}

/** Fetch lines ahead of time (when a workout opens) */
export const warm = (lines: string[], voice: string, rate: number) => Promise.all(lines.map((t) => clip(t, voice, rate))).then(() => undefined);
