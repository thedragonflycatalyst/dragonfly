// Builds src/data/library.json from Free Exercise DB (public domain, Unlicense):
//   https://github.com/yuhonas/free-exercise-db  (pinned commit below)
// Usage: node scripts/build-library.mjs /path/to/free-exercise-db/dist/exercises.json
import { readFileSync, writeFileSync } from 'node:fs';

export const COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
// Compact rows: [id, name, category, equipment, primary[], secondary[], level, mechanic, instructions[], imageCount]
const rows = src
  .map((x) => [x.id, x.name.trim(), x.category, x.equipment || 'other', x.primaryMuscles, x.secondaryMuscles, x.level, x.mechanic || '', x.instructions, x.images.length])
  .sort((a, b) => a[1].localeCompare(b[1]));
writeFileSync(new URL('../src/data/library.json', import.meta.url), JSON.stringify({ commit: COMMIT, rows }));
console.log(`wrote ${rows.length} exercises`);
