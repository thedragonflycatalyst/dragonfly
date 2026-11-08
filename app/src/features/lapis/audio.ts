// Plays Lapis cues: studio voice and bell, honoring music mixing preferences.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { clip } from './clips';
import { sameAudioGeneration } from './audio-generation';
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
  await setAudioModeAsync({
    playsInSilentMode: true, shouldPlayInBackground: true,
    interruptionMode: MODE[m],
  }).catch(() => {});
}

// Each active clip registers an idempotent finalizer. Calling hush() settles
// playback promises immediately, not six seconds later after a timeout.
const live = new Map<AudioPlayer, () => void>();
let audioGeneration = 0;
export function currentAudioGeneration() { return audioGeneration; }
function play(source: string | number, volume: number, generation: number, maxMs = 6000): Promise<void> {
  return new Promise((done) => {
    if (!sameAudioGeneration(generation, audioGeneration)) { done(); return; }
    let player: AudioPlayer | null = null;
    let removeListener = () => {};
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeout !== null) clearTimeout(timeout);
      try { removeListener(); } catch { /* listener already removed */ }
      if (player) {
        live.delete(player);
        try { player.pause(); } catch { /* already stopped */ }
        try { player.remove(); } catch { /* already disposed */ }
      }
      done();
    };
    try {
      const pl = createAudioPlayer(source);
      player = pl;
      pl.volume = volume;
      live.set(pl, finish);
      const sub = pl.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) finish();
      });
      removeListener = () => sub.remove();
      timeout = setTimeout(finish, maxMs); // never wait on a stuck clip
      if (!sameAudioGeneration(generation, audioGeneration)) { finish(); return; }
      pl.play();
    } catch {
      finish();
    }
  });
}

export const buzz = (strong = false) => {
  if (!getPrefs().haptics) return;
  Haptics.impactAsync(strong
    ? Haptics.ImpactFeedbackStyle.Heavy
    : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export async function say(text: string) {
  const generation = audioGeneration;
  const prefs = getPrefs();
  if (!prefs.voiceOn || prefs.voiceLevel <= 0) return;
  await ready();
  if (!sameAudioGeneration(generation, audioGeneration)) return;
  const uri = await clip(text, prefs.voice, prefs.voiceSpeed);
  if (uri && sameAudioGeneration(generation, audioGeneration))
    await play(uri, prefs.voiceLevel, generation);
}

export async function bell() {
  const generation = audioGeneration;
  const prefs = getPrefs();
  if (!prefs.bellOn) return;
  await ready();
  if (!sameAudioGeneration(generation, audioGeneration)) return;
  buzz(true);
  await play(BELL_FILES[prefs.bell], Math.max(0.4, prefs.voiceLevel), generation);
}

/** A bell followed by speech belongs to the *same* audio generation.
 * Navigating away, resetting or stopping during the bell cancels the speech,
 * even if the bell was already removed and its promise resolved.
 */
export async function bellThenSay(text: string) {
  const generation = audioGeneration;
  await bell();
  if (!sameAudioGeneration(generation, audioGeneration)) return;
  await say(text);
}

export function hush() {
  audioGeneration++;
  reading++;
  for (const finish of [...live.values()]) finish();
}

let reading = 0;
/**
 * Read an exercise's how-to in the Lapis voice (Connor unless they picked another), over the person's music: their music
 * keeps playing (lowered if they chose that; never paused). Resolves when finished or stopped; false if nothing could play.
 */
export async function readAloud(pieces: string[]): Promise<boolean> {
  hush();
  const me = reading;
  const generation = audioGeneration;
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
    await play(uri, p.voiceLevel > 0 ? p.voiceLevel : 1, generation, 45_000);
    played = true;
    if (me !== reading) return played;
  }
  return played;
}

/** Lines preloaded when a workout opens. */
export const CUE_LINES = ['Rest', '3', '2', '1', 'Go', 'Halfway', 'Switch sides', 'Time'];
