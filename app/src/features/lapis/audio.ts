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
async function ready() {
  const m = getPrefs().music;
  if (m === mode) return;
  mode = m;
  // Keeps playing with the screen locked; plays even when the ringer is on silent
  await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: MODE[m] }).catch(() => {});
}

const live = new Set<AudioPlayer>();
// Incremented when a workout leaves or resets its sound session. Async voice
// clip downloads from an old session must not speak after hush().
let audioGeneration = 0;
export function currentAudioGeneration() { return audioGeneration; }
function play(source: string | number, volume: number, generation: number): Promise<void> {
  return new Promise((done) => {
    try {
      if (generation !== audioGeneration) { done(); return; }
      const pl = createAudioPlayer(source);
      pl.volume = volume;
      live.add(pl);
      const end = () => { sub.remove(); live.delete(pl); try { pl.remove(); } catch { /* already gone */ } done(); };
      const sub = pl.addListener('playbackStatusUpdate', (s) => { if (s.didJustFinish) end(); });
      setTimeout(end, 6000); // never wait on a stuck clip
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
  const generation = audioGeneration;
  const p = getPrefs();
  if (!p.voiceOn || p.voiceLevel <= 0) return;
  await ready();
  if (generation !== audioGeneration) return;
  const uri = await clip(text, p.voice, p.voiceSpeed);
  if (uri && generation === audioGeneration) await play(uri, p.voiceLevel, generation);
}

/** Ring the chosen bell */
export async function bell() {
  const generation = audioGeneration;
  const p = getPrefs();
  if (!p.bellOn) return;
  await ready();
  if (generation !== audioGeneration) return;
  buzz(true);
  await play(BELL_FILES[p.bell], Math.max(0.4, p.voiceLevel), generation);
}

/** Stop anything still playing (leaving the workout) */
export function hush() { audioGeneration++; for (const pl of live) { try { pl.pause(); pl.remove(); } catch { /* gone */ } } live.clear(); }

/** Lines the rest timer and set timer use, fetched when a workout opens */
export const CUE_LINES = ['Rest', '3', '2', '1', 'Go', 'Halfway', 'Switch sides', 'Time'];
