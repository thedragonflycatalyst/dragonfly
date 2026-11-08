import type { LapisTimer } from './library';
import type { LapisPhase } from './timeline';

export type PhaseAnnouncement = { ring: boolean; speech: string | null };

const bool = (v: unknown, fallback: boolean) => typeof v === 'boolean' ? v : fallback;
/** Convert Lapis's saved VoiceOptions into a single phase-start announcement.
 * All output is generated from the saved timer snapshot, not Coach defaults.
 */
export function announcementForPhase(
  phase: LapisPhase,
  timer: Pick<LapisTimer, 'rounds' | 'slots' | 'voice'>,
): PhaseAnnouncement {
  const voice = timer.voice ?? {};
  if (phase.kind === 'work') {
    const mode = typeof voice.startSound === 'string' ? voice.startSound : 'bell';
    const announceRounds = bool(voice.announceRounds, true);
    const announceExercise = bool(voice.announceExercise, true);
    const detail: string[] = [];
    if (mode === 'voice' || mode === 'both') detail.push('Start');
    if (announceRounds && phase.round) detail.push(`Round ${phase.round} of ${timer.rounds}`);
    if (announceExercise && phase.name && phase.name !== 'Work') detail.push(phase.name);
    return { ring: mode === 'bell' || mode === 'both',
      speech: detail.length ? detail.join('. ') : null };
  }
  if (phase.kind === 'rest' || phase.kind === 'cycleRest') {
    const sayNext = bool(voice.announceNext, true);
    const sayExercise = bool(voice.announceExercise, true);
    if (sayNext && sayExercise && phase.round != null) {
      const nextRound = phase.round + 1;
      const name = timer.slots[nextRound - 1]?.exercise?.trim();
      if (name) return { ring: false, speech: `Rest. Next up: ${name}` };
    }
    return { ring: false, speech: 'Rest' };
  }
  if (phase.kind === 'prepare') return { ring: false, speech: 'Prepare' };
  if (phase.kind === 'warmup') return { ring: false, speech: 'Warmup' };
  if (phase.kind === 'cooldown') return { ring: false, speech: 'Cooldown' };
  return { ring: false, speech: null };
}
