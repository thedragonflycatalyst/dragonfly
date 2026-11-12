// "Report a problem" on an exercise (issue #58): categories, the context sent with a report, and status names.
// Pure, so it's tested; the screen is features/report-problem.tsx.

export type ReportCategory = 'name' | 'instructions' | 'muscles' | 'media' | 'duplicate' | 'variations' | 'difficulty' | 'other';
export const REPORT_CATEGORIES: [ReportCategory, string][] = [
  ['name', 'Wrong name or alias'], ['instructions', 'Wrong instructions or steps'], ['muscles', 'Muscles, equipment or position wrong'],
  ['media', 'Missing or broken image or video'], ['duplicate', 'Duplicate of another exercise'], ['variations', 'Variations or alternates don’t match'],
  ['difficulty', 'Wrong difficulty or type'], ['other', 'Something else'],
];
/** Labels for every kind ever stored (the first version had four others) */
export const KIND_LABEL: Record<string, string> = {
  ...Object.fromEntries(REPORT_CATEGORIES), redundant: 'Duplicate of another exercise', wrong_video: 'Missing or broken image or video',
  unclear: 'Wrong instructions or steps', unsafe: 'Unsafe or poor form',
};

export type ReportStatus = 'open' | 'reviewing' | 'fixed' | 'released' | 'duplicate' | 'dismissed' | 'resolved';
export const STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Submitted', reviewing: 'Under review', fixed: 'Fixed', released: 'Fixed and released', duplicate: 'Already reported', dismissed: 'Closed', resolved: 'Fixed',
};
/** Still needs a reviewer */
export const isOpen = (s: string) => s === 'open' || s === 'reviewing';

/** A short fingerprint of an exercise entry, so a report points at the exact content the tester saw */
export function revisionOf(entry: unknown): string {
  const text = JSON.stringify(entry ?? null);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

export type Draft = { client_key: string; kind: ReportCategory | null; note: string; expected: string; shot: string | null };
export const draftKey = (ref: string) => `exercise-report-draft:${ref}`;
export const emptyDraft = (client_key: string): Draft => ({ client_key, kind: null, note: '', expected: '', shot: null });
/** A draft worth keeping (something typed or chosen) */
export const hasContent = (d: Draft) => !!(d.kind || d.note.trim() || d.expected.trim() || d.shot);

export type ReportContext = { ref: string; name: string; variant?: string | null; revision?: string | null; screen: string; appVersion: string };

/** What goes to coach_report_exercise */
export function reportPayload(d: Draft, c: ReportContext, screenshotPath: string | null) {
  if (!d.kind) throw new Error('Choose what’s wrong');
  if (d.kind === 'other' && !d.note.trim()) throw new Error('Say what’s wrong');
  return {
    client_key: d.client_key, ref: c.ref, name: c.name.slice(0, 120), kind: d.kind, note: d.note.trim().slice(0, 1000), expected: d.expected.trim().slice(0, 1000),
    variant: c.variant?.slice(0, 120) ?? '', revision: c.revision ?? '', screen: c.screen, app_version: c.appVersion.slice(0, 40), screenshot_path: screenshotPath ?? '',
  };
}
export const refLabel = (n: number | string) => `R-${n}`;
