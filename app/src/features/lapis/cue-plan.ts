import type { LapisTimer } from './library';
import type { LapisTimeline } from './timeline';

export type TimedCue = { at: number; key: string; text: string; kind: 'speech' | 'countdown' };
type JsonObject = Record<string, unknown>;
const obj = (x: unknown): JsonObject | null =>
  x !== null && typeof x === 'object' && !Array.isArray(x) ? x as JsonObject : null;

/** Plan Lapis's custom per-round speech cues using the original template.
 * Built-in bell/start/rest announcements remain the runner's responsibility.
 */
export function compileSpokenCues(timer: LapisTimer, timeline: LapisTimeline): TimedCue[] {
  const out: TimedCue[] = [];
  const countdown = Number(timer.voice?.countdown ?? 3);
  for (let i = 0; i < timeline.phases.length; i++) {
    const phase = timeline.phases[i];
    if (phase.kind !== 'work') continue;
    const extras = Array.isArray(phase.cues) ? phase.cues : [];
    let customHalfway = false;
    for (let index = 0; index < extras.length; index++) {
      const cue = obj(extras[index]);
      const text = cue?.text;
      const when = cue?.when;
      if (typeof text !== 'string' || !text.trim() || text.length > 500 ||
          typeof when !== 'string') continue;
      const seconds = typeof cue?.seconds === 'number' && Number.isInteger(cue.seconds)
        ? Math.max(1, cue.seconds) : 10;
      let times: number[] = [];
      if (when === 'start') times = [phase.startAt];
      if (when === 'halfway') { times = [phase.startAt + phase.seconds / 2]; customHalfway = true; }
      if (when === 'secondsLeft' && seconds <= phase.seconds)
        times = [phase.endAt - seconds];
      if (when === 'every' && seconds > 0)
        for (let t = seconds; t < phase.seconds; t += seconds) times.push(phase.startAt + t);
      if (when === 'end') times = [phase.endAt];
      for (const at of times.slice(0, 300)) out.push({
        at, key: `custom:${i}:${index}:${at}`, text: text.trim(), kind: 'speech',
      });
    }
    const halfwayText = typeof timer.voice?.halfwayText === 'string'
      ? timer.voice.halfwayText.trim() : 'Halfway';
    if (!customHalfway && halfwayText && phase.seconds >= 6)
      out.push({ at: phase.startAt + phase.seconds / 2, key: `half:${i}`,
        text: halfwayText, kind: 'speech' });
    if (Number.isInteger(countdown) && countdown > 0)
      for (let n = Math.min(countdown, 10); n >= 1; n--) {
        if (n < phase.seconds) out.push({
          at: phase.endAt - n, key: `count:${i}:${n}`,
          text: String(n), kind: 'countdown',
        });
      }
  }
  return out.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}

/** Do not play missed spoken cues when returning from a long suspension.
 * Foreground ticks normally arrive every ~200ms; 2s leaves device jitter room.
 */
export function cuesCrossed(cues: TimedCue[], before: number, after: number): TimedCue[] {
  if (!Number.isFinite(before) || !Number.isFinite(after) ||
      after < before || after - before > 2) return [];
  return cues.filter((cue) => cue.at > before && cue.at <= after);
}
