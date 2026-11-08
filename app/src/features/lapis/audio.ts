// Plays Lapis cues: studio-voice lines and the boxing bell, mixed with (or over) the person's music the way they chose.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { clip } from './clips';
import { getPrefs, type BellStyle, type MusicMode } from './prefs';

const BELL_FILES: Record<BellStyle, number> = {
  ring1: require('../../../assets/sounds/bell_ring1.wav'),
  ring2: require('../../../assets/sounds/bell_ring2.wav'),
  ring3: require('../../../assets/sounds/bell_ring3.wav'),
};
const MODE = { mix: 'mixWithOthers', duck: 'duckOthers', pause: 'doNotMix' } as const;

let mode: MusicMode | null = null;
async function ready(over?: MusicMode) {
  const m = over ?? getPrefs().music;
  if (m === mode) return;
  mode = m;
  // Keeps playing with the screen locked; plays even when the ringer is on silent
  await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: MODE[m] }).catch(() => {});
}

const live = new Set<AudioPlayer>();
function play(source: string | number, volume: number, maxMs = 6000): Promise<void> {
  return new Promise((done) => {
    try {
      const pl = createAudioPlayer(source);
      pl.volume = volume;
      live.add(pl);
      const end = () => { sub.remove(); live.delete(pl); try { pl.remove(); } catch { /* already gone */ } done(); };
      const sub = pl.addListener('playbackStatusUpdate', (s) => { if (s.didJustFinish) end(); });
      setTimeout(end, maxMs); // never wait on a stuck clip
      pl.play();
    } catch { done(); }
  });
}

export const buzz = (strong = false) => {
  if (!getPrefs().haptics) return;
  Haptics.impactAsync(strong ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Say a line in the chosen Lapis voice (skipped when the voice is off or the line isn't available offline) */
export async function say(text: string) {
  const p = getPrefs();
  if (!p.voiceOn || p.voiceLevel <= 0) return;
  await ready();
  const uri = await clip(text, p.voice, p.voiceSpeed);
  if (uri) await play(uri, p.voiceLevel);
}

/** Ring the chosen bell */
export async function bell() {
  const p = getPrefs();
  if (!p.bellOn) return;
  await ready();
  buzz(true);
  await play(BELL_FILES[p.bell], Math.max(0.4, p.voiceLevel));
}

/** Stop anything still playing (leaving the workout) */
export function hush() { reading++; for (const pl of live) { try { pl.pause(); pl.remove(); } catch { /* gone */ } } live.clear(); }

let reading = 0;
/**
 * Read an exercise's how-to in the Lapis voice (Connor unless they picked another), over the person's music: their music
 * keeps playing (lowered if they chose that; never paused). Resolves when finished or stopped; false if nothing could play.
 */
export async function readAloud(pieces: string[]): Promise<boolean> {
  hush();
  const me = reading;
  const p = getPrefs();
  await ready(p.music === 'pause' ? 'duck' : p.music);
  const next = (i: number) => (i < pieces.length ? clip(pieces[i], p.voice, p.voiceSpeed) : Promise.resolve(null));
  let ahead = next(0);
  let played = false;
  for (let i = 0; i < pieces.length; i++) {
    const uri = await ahead;
    if (me !== reading) return played;
    ahead = next(i + 1); // fetch the next piece while this one plays
    if (!uri) return played;
    await play(uri, p.voiceLevel > 0 ? p.voiceLevel : 1, 45_000);
    played = true;
    if (me !== reading) return played;
  }
  return played;
}

/** Lines the rest timer and set timer use, fetched when a workout opens */
export const CUE_LINES = ['Rest', '3', '2', '1', 'Go', 'Halfway', 'Switch sides', 'Time'];
