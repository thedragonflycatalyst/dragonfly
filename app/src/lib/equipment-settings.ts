// Machine and bench settings (owner, Nov 10 2026): the adjustment slots for an exercise's equipment, e.g. a decline
// bench's notch (1-4) or a leg extension's seat back, shin pad and range-of-motion start. What a client used is saved
// with the session and filled in again next time, so the setup carries over week to week. Pure, so it's tested.
import type { ExerciseTime } from './history';

type Rule = { name?: RegExp; gear?: RegExp; fields: string[] };

// Specific machines first (by exercise name), then by the equipment it uses. Terms are the usual gym ones.
const RULES: Rule[] = [
  { name: /leg extension/i, fields: ['Seat back', 'Shin pad', 'Range of motion start'] },
  { name: /leg curl|hamstring curl/i, fields: ['Back pad', 'Ankle pad', 'Thigh pad', 'Range of motion start'] },
  { name: /leg press|hack squat/i, fields: ['Seat back', 'Foot position', 'Safety stop'] },
  { name: /lat pull ?down|pulldown/i, fields: ['Seat height', 'Thigh pad'] },
  { name: /seated (cable )?row|low row machine|row machine/i, fields: ['Seat height', 'Chest pad'] },
  { name: /chest press|shoulder press machine|machine (chest|shoulder) press/i, fields: ['Seat height', 'Handle start position'] },
  { name: /pec deck|reverse fly machine|rear delt machine|machine fly/i, fields: ['Seat height', 'Arm start position'] },
  { name: /hip (abduct|adduct)|abductor|adductor/i, fields: ['Leg width start', 'Seat back'] },
  { name: /calf raise/i, fields: ['Shoulder pad height'] },
  { name: /preacher/i, fields: ['Seat height'] },
  { name: /back extension|hyperextension/i, fields: ['Hip pad height'] },
  { name: /\bghd\b|glute ham/i, fields: ['Foot plate distance'] },
  { name: /squat|bench press|rack pull|pin press/i, gear: /barbell|specialty bar|safety squat bar/i, fields: ['J-hook height', 'Safety pin height'] },
  { gear: /decline bench/i, fields: ['Decline setting', 'Leg roller'] },
  { gear: /incline bench/i, fields: ['Back angle', 'Seat angle'] },
  { gear: /^bench$/i, fields: ['Back angle', 'Seat angle'] },
  { gear: /cable machine/i, fields: ['Pulley height', 'Attachment'] },
  { gear: /smith machine/i, fields: ['Bar hook height', 'Safety stop'] },
  { gear: /plate-loaded machine|^machine$/i, fields: ['Seat height', 'Pad position'] },
  { gear: /suspension trainer|trx/i, fields: ['Strap length'] },
  { gear: /pilates reformer/i, fields: ['Springs', 'Footbar', 'Headrest', 'Gear'] },
  { gear: /pilates chair/i, fields: ['Springs', 'Pedal'] },
  { gear: /incline trainer|total gym/i, fields: ['Level'] },
  { gear: /exercise bike|air bike/i, fields: ['Seat height', 'Handlebar'] },
  { gear: /rower|ski erg/i, fields: ['Damper', 'Foot stretcher'] },
  { gear: /landmine/i, fields: ['Pivot height'] },
];

/** The setting slots to offer for an exercise (empty when its equipment has nothing to adjust) */
export function settingFields(ex: { name: string; gear?: string[]; equipment?: string } | null | undefined): string[] {
  if (!ex) return [];
  const gear = ex.gear?.length ? ex.gear : (ex.equipment ?? '').split(',').map((g) => g.trim()).filter(Boolean);
  const out: string[] = [];
  for (const r of RULES) {
    if (r.name && !r.name.test(ex.name)) continue;
    if (r.gear && !gear.some((g) => r.gear!.test(g))) continue;
    for (const f of r.fields) if (!out.includes(f)) out.push(f);
    if (r.name) break; // a specific machine's slots are the whole set
  }
  return out;
}

/** What they set last time (newest session that had any), to carry over */
export function lastSettings(hist: ExerciseTime[]): Record<string, string> | undefined {
  return hist.find((h) => h.settings && Object.values(h.settings).some((v) => v.trim()))?.settings;
}

/** "Decline setting 3 · Leg roller 2" */
export const settingsLine = (s: Record<string, string> | undefined) =>
  Object.entries(s ?? {}).filter(([, v]) => v.trim()).map(([k, v]) => `${k} ${v.trim()}`).join(' · ');

/** Keep settings tidy: trimmed, short, at most 8 slots */
export function cleanSettings(s: Record<string, string>): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(s).slice(0, 8)) {
    const key = k.trim().slice(0, 30), val = v.trim().slice(0, 20);
    if (key) out[key] = val;
  }
  return Object.keys(out).length ? out : undefined;
}
