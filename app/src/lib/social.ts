// Chat and community attachments live in the private "coach-social" bucket: {chat|community}/{id}/{name}
import { bytesOf, rand } from './files';
import { sb } from './supabase';

export const SOCIAL = 'coach-social';
export async function uploadSocial(kind: 'chat' | 'community', id: string, uri: string, mime: string, ext: string): Promise<string> {
  const path = `${kind}/${id}/${rand()}.${ext}`;
  const { error } = await sb.storage.from(SOCIAL).upload(path, await bytesOf(uri), { contentType: mime });
  if (error) throw error;
  return path;
}
const cache = new Map<string, { url: string; until: number }>();
/** Signed links (cached for most of their hour) */
export async function socialUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now(), out: Record<string, string> = {}, need: string[] = [];
  for (const p of new Set(paths)) { const c = cache.get(p); if (c && c.until > now) out[p] = c.url; else need.push(p); }
  if (need.length) {
    const { data } = await sb.storage.from(SOCIAL).createSignedUrls(need, 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) { out[d.path] = d.signedUrl; cache.set(d.path, { url: d.signedUrl, until: now + 50 * 60_000 }); }
  }
  return out;
}
export const extOf = (name: string, fallback: string) => (name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? fallback).toLowerCase();
