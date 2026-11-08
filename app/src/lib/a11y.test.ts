import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PALETTES } from './theme';

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test('colour contrast meets WCAG AA (4.5:1) for text pairs we use', () => {
  for (const [name, p] of Object.entries(PALETTES)) {
    for (const bg of [p.bg, p.surface, p.raise, p.soft]) {
      assert.ok(ratio(p.ink, bg) >= 4.5, `${name} ink on ${bg}`);
      assert.ok(ratio(p.muted, bg) >= 4.5, `${name} muted on ${bg}`);
      assert.ok(ratio(p.focus, bg) >= 4.5, `${name} focus text on ${bg}: ${ratio(p.focus, bg).toFixed(2)}`);
    }
    assert.ok(ratio(p.onAccent, p.fill) >= 4.5, `${name} button text on fill: ${ratio(p.onAccent, p.fill).toFixed(2)}`);
    assert.ok(ratio(p.onGood, p.good) >= 4.5, `${name} text on good: ${ratio(p.onGood, p.good).toFixed(2)}`);
  }
});

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : []; });

test('every image is labelled or marked decorative (screen readers, web alt text)', () => {
  const missing: string[] = [];
  for (const f of files(join(import.meta.dirname, '..'))) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<Image\b[\s\S]*?\/>/g)) if (!/accessibilityLabel=/.test(m[0])) missing.push(`${f}:${s.slice(0, m.index).split('\n').length}`);
  }
  assert.deepEqual(missing, []);
});
