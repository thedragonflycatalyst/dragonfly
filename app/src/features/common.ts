import { useCallback, useEffect, useState } from 'react';
import type { Client } from '@/lib/model';
import { sb } from '@/lib/supabase';
import type { Units } from '@/lib/units';

/** Who is looking at a client section: the trainer, or the client themselves */
export type Role = 'coach' | 'client';
export type SectionProps = { client: Client; role: Role; units: Units; me: string };

/** Loads one client record (trainer side) and keeps it fresh */
export function useClientRecord(id: string | undefined) {
  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const reload = useCallback(async () => {
    if (!id) return setClient(null);
    const { data } = await sb.from('coach_clients').select('*').eq('id', id).maybeSingle();
    setClient((data as Client) ?? null);
  }, [id]);
  useEffect(() => { reload(); }, [reload]);
  return { client, reload };
}

/** Sections of a client's profile. `coachOnly` ones never show to the client. */
export const SECTIONS = {
  activity: { title: 'Activity', icon: 'timeline' },
  measurements: { title: 'Measurements', icon: 'straighten' },
  photos: { title: 'Progress photos', icon: 'photo_camera' },
  habits: { title: 'Habits', icon: 'task_alt' },
  goals: { title: 'Goals and interests', icon: 'flag' },
  forms: { title: 'Forms', icon: 'description' },
  files: { title: 'Files', icon: 'attach_file' },
  notes: { title: 'Notes', icon: 'sticky_note_2', coachOnly: true },
} as const;
export type SectionKey = keyof typeof SECTIONS;
export const isSection = (s: string | undefined): s is SectionKey => !!s && s in SECTIONS;
