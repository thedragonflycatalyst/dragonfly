import { type LapisTimer, lapisTimerSeconds } from './library';

export type LapisPhase = {
  kind: 'prepare' | 'warmup' | 'work' | 'rest' | 'cycleRest' | 'cooldown';
  name: string;
  seconds: number;
  startAt: number;
  endAt: number;
  round?: number;
  cycle?: number;
  cues?: unknown[];
};
export type LapisTimeline = { phases: LapisPhase[]; totalSeconds: number };

/** Deterministic timer compilation from the saved Flutter template.
 * The UI can use startAt/endAt with a monotonic clock rather than chaining
 * JS timeouts. Exercise/voice cues remain in their original round slots.
 */
export function compileLapisTimeline(timer: LapisTimer): LapisTimeline {
  const phases: LapisPhase[] = [];
  let cursor = 0;
  const add = (kind: LapisPhase['kind'], name: string, seconds: number,
    extra: Pick<LapisPhase, 'round' | 'cycle' | 'cues'> = {}) => {
    if (!seconds) return;
    phases.push({ kind, name, seconds, startAt: cursor, endAt: cursor + seconds, ...extra });
    cursor += seconds;
  };
  add('prepare', 'Prepare', timer.prepare);
  add('warmup', 'Warmup', timer.warmup);
  for (let cycle = 1; cycle <= timer.cycles; cycle++) {
    for (let round = 1; round <= timer.rounds; round++) {
      const slot = timer.slots[round - 1];
      add('work', slot?.exercise?.trim() || 'Work', slot?.work ?? timer.work,
        { round, cycle, cues: slot?.cues });
      if (round < timer.rounds) add('rest', 'Rest', timer.rest, { round, cycle });
    }
    if (cycle < timer.cycles) add('cycleRest', 'Rest between cycles', timer.restBetweenCycles, { cycle });
  }
  add('cooldown', 'Cooldown', timer.cooldown);
  if (cursor !== lapisTimerSeconds(timer)) throw new Error('Timer timeline duration mismatch');
  return { phases, totalSeconds: cursor };
}

/** Safe on screen lock/unlock: determine the current interval from elapsed time. */
export function phaseAt(timeline: LapisTimeline, elapsedSeconds: number): {
  phase: LapisPhase | null;
  left: number;
  finished: boolean;
} {
  if (!Number.isFinite(elapsedSeconds)) elapsedSeconds = 0;
  const t = Math.max(0, elapsedSeconds);
  if (t >= timeline.totalSeconds) return { phase: null, left: 0, finished: true };
  const phase = timeline.phases.find((p) => t < p.endAt) ?? null;
  return { phase, left: phase ? Math.max(0, phase.endAt - t) : 0, finished: false };
}
