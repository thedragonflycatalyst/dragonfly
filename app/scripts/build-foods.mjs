// Builds src/data/foods.json from USDA FoodData Central "SR Legacy" (2019-04 release, CSV).
// USDA FoodData Central data is public domain (CC0). Usage: node scripts/build-foods.mjs <folder with the SR Legacy CSVs>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('Pass the folder that holds food.csv, food_nutrient.csv, food_portion.csv');
function rows(file) {
  const text = readFileSync(join(dir, file), 'utf8').trim().split('\n');
  const parse = (l) => { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i];
    if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur.replace(/\r$/, '')); return out; };
  const head = parse(text[0]);
  return text.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
}
const NUT = { 1008: 0, 1003: 1, 1005: 2, 1004: 3, 2000: 4, 1079: 5, 1093: 6 }; // kcal, protein, carbs, fat, sugar, fibre, sodium(mg)
const SKIP = new Set(['Baby Foods', 'Quality Control Materials']);
const cats = Object.fromEntries(rows('food_category.csv').map((c) => [c.id, c.description]));
const units = Object.fromEntries(rows('measure_unit.csv').map((u) => [u.id, u.name]));
const catNames = [...new Set(Object.values(cats).filter((c) => !SKIP.has(c)))].sort();
const foods = new Map();
for (const f of rows('food.csv')) {
  const cat = cats[f.food_category_id];
  if (!cat || SKIP.has(cat)) continue;
  foods.set(f.fdc_id, { id: Number(f.fdc_id), name: f.description, cat: catNames.indexOf(cat), n: [null, null, null, null, null, null, null], portions: [] });
}
for (const r of rows('food_nutrient.csv')) {
  const f = foods.get(r.fdc_id); const k = NUT[r.nutrient_id];
  if (f && k !== undefined && r.amount !== '') f.n[k] = Math.round(Number(r.amount) * 10) / 10;
}
const r1 = (x) => Math.round(x * 10) / 10;
for (const p of rows('food_portion.csv')) {
  const f = foods.get(p.fdc_id); const g = Number(p.gram_weight);
  if (!f || !(g > 0)) continue;
  const unit = units[p.measure_unit_id];
  const what = [unit && unit !== 'undetermined' ? unit : '', p.portion_description, p.modifier].filter(Boolean).join(' ').trim() || 'serving';
  f.portions.push([`${Number(p.amount) || 1} ${what}`.slice(0, 60), r1(g)]);
}
const out = [...foods.values()].filter((f) => f.n[0] !== null).sort((a, b) => a.name.localeCompare(b.name))
  .map((f) => [f.id, f.name, f.cat, ...f.n.map((v) => v ?? 0), f.portions.slice(0, 6)]);
writeFileSync(new URL('../src/data/foods.json', import.meta.url), JSON.stringify({ source: 'USDA FoodData Central, SR Legacy (public domain)', categories: catNames, foods: out }));
console.log(out.length, 'foods,', catNames.length, 'categories');
