// Progress photos and client files live in the private "coach-private" bucket:
//   {trainer_id}/{client_id}/{photos|files}/{random}.{ext}
// Only the trainer and the (active) client can read them, through short-lived signed links.
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import type { Client } from './model';
import { sb } from './supabase';

export const BUCKET = 'coach-private';
const MAX_FILE = 25 * 1024 * 1024;

export const rand = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const folder = (c: Pick<Client, 'trainer_id' | 'id'>, kind: 'photos' | 'files' | 'meals') => `${c.trainer_id}/${c.id}/${kind}`;

export async function bytesOf(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  const { File } = await import('expo-file-system');
  return new File(uri).arrayBuffer();
}

/** Lets the person take or choose a photo; returns a local JPEG (max 1600 px) or null if they cancelled. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Allow camera access in your phone’s settings to take progress photos.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const resize = Math.max(a.width, a.height) > 1600 ? [{ resize: a.width >= a.height ? { width: 1600 } : { height: 1600 } }] : [];
  const out = await ImageManipulator.manipulateAsync(a.uri, resize, { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
  return out.uri;
}

export async function uploadPhoto(c: Client, localUri: string): Promise<string> {
  const path = `${folder(c, 'photos')}/${rand()}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, await bytesOf(localUri), { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export type Picked = { uri: string; name: string; size: number | null; mime: string | null };
export async function pickDocument(): Promise<Picked | null> {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  if (a.size && a.size > MAX_FILE) throw new Error('That file is over 25 MB. Choose a smaller one.');
  return { uri: a.uri, name: a.name, size: a.size ?? null, mime: a.mimeType ?? null };
}

export async function uploadFile(c: Client, f: Picked): Promise<string> {
  const ext = (f.name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? 'bin').toLowerCase();
  const path = `${folder(c, 'files')}/${rand()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, await bytesOf(f.uri), { contentType: f.mime ?? 'application/octet-stream' });
  if (error) throw error;
  return path;
}

/** Signed links for several stored paths at once (valid one hour) */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export async function removeStored(paths: string[]) {
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
}

export const fmtSize = (b: number | null) => (b == null ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
