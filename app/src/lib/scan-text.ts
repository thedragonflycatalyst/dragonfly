// What the live appointment scanner looks for in the text the phone reads, before asking the AI.

/** Start/end times written in the text ("03:00pm", "3 PM", "15:30"), as 24-hour HH:MM, in reading order */
export function timesIn(text: string): string[] {
  const out: string[] = [];
  const re = /\b(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?\s*m\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/gi;
  for (const m of text.matchAll(re)) {
    let h: number, mi: number;
    if (m[3]) {
      h = Number(m[1]); mi = Number(m[2] ?? 0);
      if (h < 1 || h > 12) continue;
      if (m[3].toLowerCase() === 'p' && h !== 12) h += 12;
      if (m[3].toLowerCase() === 'a' && h === 12) h = 0;
    } else { h = Number(m[4]); mi = Number(m[5]); }
    out.push(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`);
  }
  return out;
}

/**
 * A fingerprint of an appointment on screen, or null when the frame doesn't look like one yet.
 * Two frames in a row with the same fingerprint mean the camera is steady and the text is sharp.
 */
export function appointmentKey(text: string): string | null {
  const words = text.split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w));
  const times = [...new Set(timesIn(text))].sort();
  if (!times.length || words.length < 3) return null;
  return times.join(',');
}
