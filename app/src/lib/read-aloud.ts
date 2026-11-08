// What the voice reads for an exercise: its name, then only the how-to (setup, movement, cues, tips). Muscles, equipment,
// movement pattern and other names are left for the screen. The voice service takes up to 300 characters per clip, so the
// script is cut into sentence-sized pieces that play one after another.

export const CLIP_MAX = 280;

type Readable = { name: string; steps?: string[]; how?: { setup: string; move: string; cues: string } };

const sentence = (s: string) => {
  const t = s.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').replace(/\s+/g, ' ').trim();
  return t && !/[.!?:]$/.test(t) ? `${t}.` : t;
};

/** The script for one exercise, or '' when it has no how-to text */
export function spokenText(ex: Readable): string {
  const parts = ex.how ? [ex.how.setup, ex.how.move, ex.how.cues] : ex.steps ?? [];
  const body = parts.flatMap((p) => (p ?? '').split('\n')).map(sentence).filter(Boolean).join(' ');
  return body ? `${sentence(ex.name)} ${body}` : '';
}

/** Cut a script into clips of at most `max` characters, breaking between sentences, then commas, then words */
export function clips(text: string, max = CLIP_MAX): string[] {
  const out: string[] = [];
  let cur = '';
  const push = (piece: string) => {
    if (!piece) return;
    if (!cur) cur = piece;
    else if (cur.length + 1 + piece.length <= max) cur += ` ${piece}`;
    else { out.push(cur); cur = piece; }
  };
  const fit = (s: string, seps: RegExp[]): void => {
    if (s.length <= max) return push(s);
    const [sep, ...rest] = seps;
    if (!sep) {
      for (const w of s.split(' ')) {
        if (w.length > max) { push(w.slice(0, max)); continue; }
        push(w);
      }
      return;
    }
    for (const p of s.split(sep).map((x) => x.trim()).filter(Boolean)) fit(p, rest);
  };
  fit(text.replace(/\s+/g, ' ').trim(), [/(?<=[.!?])\s+/, /(?<=[,;])\s+/]);
  if (cur) out.push(cur);
  return out;
}
