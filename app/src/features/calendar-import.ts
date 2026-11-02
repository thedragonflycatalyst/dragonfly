import * as ImageManipulator from 'expo-image-manipulator';
import { at } from '@/lib/business';
import { dayKey } from '@/lib/dates';
import { callFn } from '@/lib/fn';
import type { Client } from '@/lib/model';
import { sb } from '@/lib/supabase';

/** dated false: the picture showed no date, so the trainer picks the day (date is '') */
export type FoundSession = { client: string; title: string; date: string; dated?: boolean; time: string; minutes: number; location: string };
export type NewBooking = { trainer_id: string | undefined; client_id: string | null; title: string; kind: 'session'; starts_at: string; duration_min: number; location: string | null };

/** Sends one photo to be read (the AI lists the sessions in it; nothing is saved) */
export async function readAppointments(uri: string, width: number, height: number, clients: Client[]): Promise<FoundSession[]> {
  const out = await ImageManipulator.manipulateAsync(uri, Math.max(width, height) > 1600 ? [{ resize: width >= height ? { width: 1600 } : { height: 1600 } }] : [],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  const r = await callFn<{ sessions: FoundSession[] }>('coach-calendar-import', { image: out.base64, today: dayKey(new Date()), clients: clients.map((c) => c.name) });
  return r.sessions;
}

/** Turns what was read into calendar sessions, matched to clients by name where possible */
export function toBookings(found: FoundSession[], clients: Client[], trainerId: string | undefined, day?: string): NewBooking[] {
  return found.map((s) => {
    const date = s.dated === false || !s.date ? (day ?? dayKey(new Date())) : s.date;
    const name = s.client.toLowerCase();
    const c = clients.find((x) => x.name.toLowerCase() === name)
      ?? clients.find((x) => !!name && (x.last_name ?? '').toLowerCase() !== '' && name.includes((x.last_name ?? '').toLowerCase()) && name.includes(x.first_name.toLowerCase()))
      ?? clients.find((x) => !!name && x.name.toLowerCase().startsWith(name.split(' ')[0]));
    return { trainer_id: trainerId, client_id: c?.id ?? null, title: c ? `Session with ${c.first_name}` : s.client ? `${s.title} · ${s.client}` : s.title, kind: 'session',
      starts_at: at(date, s.time).toISOString(), duration_min: s.minutes, location: s.location || null };
  });
}

export const needsDay = (found: FoundSession[]) => found.some((s) => s.dated === false || !s.date);
export const bookingLine = (b: NewBooking) => `${new Date(b.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}: ${b.title}`;

export async function addBookings(rows: NewBooking[]) {
  const { error } = await sb.from('coach_bookings').insert(rows);
  if (error) throw error;
}
