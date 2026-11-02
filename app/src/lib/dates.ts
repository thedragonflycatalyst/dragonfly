export const startOfDay = (d: Date | string) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d: Date | string, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** Local calendar day as YYYY-MM-DD (what `date` columns hold) */
export const dayKey = (d: Date | string) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
/** A YYYY-MM-DD day at local noon, so it never slips a day across time zones */
export const fromKey = (k: string) => new Date(`${k}T12:00:00`);

export const fmtShort = (d: Date | string) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** "Today", "Tomorrow", a weekday this week, else "Nov 12" — for YYYY-MM-DD days */
export function relDay(k: string, today = new Date()) {
  const t = dayKey(today);
  if (k === t) return 'Today';
  if (k === dayKey(addDays(today, 1))) return 'Tomorrow';
  if (k === dayKey(addDays(today, -1))) return 'Yesterday';
  if (k > t && k < dayKey(addDays(today, 7))) return fromKey(k).toLocaleDateString(undefined, { weekday: 'long' });
  return fromKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** relDay for mid-sentence use: "today", "yesterday", but month names keep their capital */
export const lowRel = (k: string, today = new Date()) => { const r = relDay(k, today); return /^(Today|Tomorrow|Yesterday)$/.test(r) ? r.toLowerCase() : r; };
