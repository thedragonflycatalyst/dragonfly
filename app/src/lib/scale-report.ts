// Shareable Scale progress snapshot. Pure calculation: no personal information
// or app-access side effects; the user explicitly decides whether to share it.
import { fmtMass, fmtNum, fromKg, signed, trend, unitLabel, type BodyUnit, type Weighin } from './scale';

export type ScaleProgress = {
  start: string;
  end: string;
  startKg: number;
  endKg: number;
  changeKg: number;
  changePct: number;
  trendKg: number;
  goalKg: number | null;
  count: number;
  rangeLabel: string;
};

/** Uses actual weighed endpoints inside the period; never implies missing
 * days were observed, or fabricates a change from a single measurement. */
export function scaleProgress(
  entries: Pick<Weighin, 'measured_at' | 'weight_kg'>[],
  days: number | null,
  goalKg: number | null,
  now = new Date(),
): ScaleProgress | null {
  const cutoff = days == null ? -Infinity : now.getTime() - days * 86_400_000;
  const observations = entries
    .map((w) => ({ t: new Date(w.measured_at).getTime(), kg: Number(w.weight_kg) }))
    .filter((w) => Number.isFinite(w.t) && w.t >= cutoff && w.t <= now.getTime() && Number.isFinite(w.kg) && w.kg >= 20 && w.kg <= 400)
    .sort((a, b) => a.t - b.t);
  if (!observations.length) return null;
  const start = observations[0], end = observations[observations.length - 1];
  const changeKg = end.kg - start.kg;
  const history = trend(observations.map((w) => ({ measured_at: new Date(w.t).toISOString(), weight_kg: w.kg })));
  return {
    start: new Date(start.t).toISOString(),
    end: new Date(end.t).toISOString(),
    startKg: start.kg,
    endKg: end.kg,
    changeKg,
    changePct: observations.length >= 2 ? changeKg / start.kg * 100 : 0,
    trendKg: history[history.length - 1].trend,
    goalKg: goalKg != null && Number.isFinite(goalKg) ? goalKg : null,
    count: observations.length,
    rangeLabel: days == null ? 'All recorded history' : `Last ${days} days`,
  };
}
export function progressShareText(p: ScaleProgress, unit: BodyUnit, format: 'dot' | 'comma' = 'dot') {
  const date = (iso: string) => iso.slice(0, 10);
  const lines = [
    'Dragonfly Coach · Weight progress',
    `${p.rangeLabel} · ${date(p.start)} to ${date(p.end)}`,
    `Starting weight: ${fmtMass(p.startKg, unit, format)}`,
    `Latest weight: ${fmtMass(p.endKg, unit, format)}`,
    p.count >= 2
      ? `Change: ${signed(fromKg(p.changeKg, unit), 1, format)} ${unitLabel(unit)} (${signed(p.changePct, 1, format)}%)`
      : 'Change: Not enough measurements',
    `Smoothed trend: ${fmtMass(p.trendKg, unit, format)}`,
    ...(p.goalKg == null ? [] : [
      `Goal: ${fmtMass(p.goalKg, unit, format)}`,
      `Distance to goal: ${fmtNum(Math.abs(fromKg(p.goalKg - p.trendKg, unit)), 1, format)} ${unitLabel(unit)}`,
    ]),
    `Measurements in period: ${p.count}`,
    'Shared by the user from Dragonfly Coach.',
  ];
  return lines.join('\n');
}
