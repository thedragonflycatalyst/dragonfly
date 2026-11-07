// Consent for reading the phone's health store (Health Connect), and the client's own health-data export.
// Pure logic so it can be tested; storage and screens live in features/health-consent.ts and app/health-consent.tsx.

/** Bump when what we read or why changes: everyone is asked again. */
export const CONSENT_VERSION = 1;

export type HealthConsent = { version: number; granted_at: string | null; withdrawn_at: string | null };
export const noConsent = (): HealthConsent => ({ version: CONSENT_VERSION, granted_at: null, withdrawn_at: null });

/** True only for an explicit, current, not-withdrawn yes. Anything else (missing, old version, withdrawn) is no. */
export function hasConsent(c: HealthConsent | null | undefined): boolean {
  if (!c || c.version !== CONSENT_VERSION || !c.granted_at) return false;
  return !c.withdrawn_at || new Date(c.withdrawn_at).getTime() < new Date(c.granted_at).getTime();
}
export const grantConsent = (now = new Date()): HealthConsent => ({ version: CONSENT_VERSION, granted_at: now.toISOString(), withdrawn_at: null });
export const withdrawConsent = (c: HealthConsent | null | undefined, now = new Date()): HealthConsent =>
  ({ version: c?.version ?? CONSENT_VERSION, granted_at: c?.granted_at ?? null, withdrawn_at: now.toISOString() });

/** What the consent screen lists, in plain words. Keep in step with TYPES in features/health-connect.android.ts. */
export const HEALTH_READS: [string, string][] = [
  ['Body', 'Weight, height, body fat, lean, bone and water mass, BMR'],
  ['Activity', 'Steps, active calories, distance and workouts'],
  ['Sleep and heart', 'Sleep sessions, resting heart rate and HRV'],
  ['Food and water', 'Meals and water you log in other apps'],
];

export type HealthExport = {
  daily: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  weighins: Record<string, unknown>[];
  food: Record<string, unknown>[];
};
const SECTIONS = ['daily', 'activities', 'weighins', 'food'] as const;

export function exportJson(data: HealthExport, consent: HealthConsent | null, now = new Date()): string {
  return JSON.stringify({ exported_at: now.toISOString(), consent, ...data }, null, 2);
}

const cell = (v: unknown): string => {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Quote anything with a separator, quote or newline; also neutralise spreadsheet formulas
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** One CSV per section, columns in first-seen order. */
export function toCsv(rows: Record<string, unknown>[]): string {
  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  return [cols.map(cell).join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}

/** All sections in one file: a "# section" line before each table. */
export function exportCsv(data: HealthExport): string {
  return SECTIONS.map((s) => `# ${s}\n${toCsv(data[s])}`).join('\n\n');
}
