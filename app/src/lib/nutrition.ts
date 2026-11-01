// Nutrition plans: foods, meals, totals and macro targets. Pure functions so they can be tested.
export type Nutr = { kcal: number; protein: number; carbs: number; fat: number; sugar: number; fibre: number; sodium: number };
export const NUTRIENTS: [keyof Nutr, string, string][] = [
  ['kcal', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g'],
  ['sugar', 'Sugar', 'g'], ['fibre', 'Fibre', 'g'], ['sodium', 'Sodium', 'mg'],
];
export const ZERO: Nutr = { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fibre: 0, sodium: 0 };

/** A portion the food can be measured in; `g` is its weight when known */
export type Portion = { label: string; g?: number };
/** A food copied into the plan (so later edits to the source don't change saved plans).
 *  base '100g': n is per 100 g (USDA foods). base 'serving': n is per one serving (custom foods). */
export type FoodSnap = { src: 'usda' | 'my'; id: string; name: string; base: '100g' | 'serving'; n: Nutr; portions: Portion[] };
export type MealItem = { id: string; food: FoodSnap; qty: number; portion: string };
export type Meal = { id: string; name: string; items: MealItem[]; note?: string };
export type MacroMode = 'g' | 'pct';
export type Targets = { on: boolean; mode: MacroMode } & Nutr;
export const NO_TARGETS: Targets = { on: false, mode: 'g', ...ZERO };

export type NutritionPlan = {
  id: string; trainer_id: string; name: string; description: string | null; notes: string | null; cover: string | null;
  folder_id: string | null; targets: Targets; meals: Meal[]; archived: boolean; last_used_at: string | null; created_at: string; updated_at: string;
};
export type CustomFood = {
  id: string; trainer_id: string; name: string; brand: string | null; serving_label: string; serving_g: number | null;
  kcal: number; protein: number; carbs: number; fat: number; sugar: number; fibre: number; sodium: number; archived: boolean;
};

let seq = 0;
export const newId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const DEFAULT_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'];
export const blankMeals = (): Meal[] => DEFAULT_MEALS.map((name) => ({ id: newId(), name, items: [] }));

const r1 = (x: number) => Math.round(x * 10) / 10;
const add = (a: Nutr, b: Nutr): Nutr => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat, sugar: a.sugar + b.sugar, fibre: a.fibre + b.fibre, sodium: a.sodium + b.sodium });
const scale = (n: Nutr, f: number): Nutr => ({ kcal: n.kcal * f, protein: n.protein * f, carbs: n.carbs * f, fat: n.fat * f, sugar: n.sugar * f, fibre: n.fibre * f, sodium: n.sodium * f });
export const round = (n: Nutr): Nutr => ({ kcal: Math.round(n.kcal), protein: r1(n.protein), carbs: r1(n.carbs), fat: r1(n.fat), sugar: r1(n.sugar), fibre: r1(n.fibre), sodium: Math.round(n.sodium) });

/** Grams in one of a food's portions ('g' means one gram) */
export function portionGrams(food: FoodSnap, portion: string): number | null {
  if (portion === 'g') return 1;
  if (portion === 'oz') return 28.35;
  return food.portions.find((p) => p.label === portion)?.g ?? null;
}
/** How many of the food's base units (100 g, or servings) this item is */
export function baseFactor(item: MealItem): number {
  const qty = Number.isFinite(item.qty) && item.qty > 0 ? item.qty : 0;
  if (item.food.base === 'serving') {
    if (item.portion === 'serving' || item.portion === item.food.portions[0]?.label) return qty;
    const per = item.food.portions[0]?.g; const g = portionGrams(item.food, item.portion);
    return per && g ? (qty * g) / per : qty;
  }
  const g = portionGrams(item.food, item.portion);
  return g === null ? 0 : (qty * g) / 100;
}
export const itemNutr = (item: MealItem) => scale(item.food.n, baseFactor(item));
export const mealNutr = (m: Meal) => m.items.reduce((t, i) => add(t, itemNutr(i)), ZERO);
export const planNutr = (meals: Meal[]) => meals.reduce((t, m) => add(t, mealNutr(m)), ZERO);

/** Portions to choose from for a food: its own, plus grams and ounces when the weight is known */
export function portionChoices(food: FoodSnap): string[] {
  const own = food.portions.map((p) => p.label);
  if (food.base === 'serving' && !food.portions[0]?.g) return own.length ? own : ['serving'];
  return [...own, 'g', 'oz'];
}
export const defaultItem = (food: FoodSnap): MealItem => {
  // A medium one beats "1 cup, mashed" when the food comes in sizes
  const first = food.portions.find((p) => /\bmedium\b/i.test(p.label)) ?? food.portions[0];
  return first ? { id: newId(), food, qty: 1, portion: first.label } : { id: newId(), food, qty: 100, portion: 'g' };
};
export const describe = (i: MealItem) => `${+i.qty.toFixed(2)} ${i.portion === 'g' ? 'g' : i.portion === 'oz' ? 'oz' : i.portion.replace(/^1 /, '')}`;

/** Targets in grams: percentage mode turns % of calories into grams (protein and carbs 4 kcal/g, fat 9) */
export function targetGrams(t: Targets): Nutr {
  if (t.mode === 'g') return { ...t };
  return { ...t, protein: r1((t.kcal * t.protein) / 100 / 4), carbs: r1((t.kcal * t.carbs) / 100 / 4), fat: r1((t.kcal * t.fat) / 100 / 9) };
}
/** Share of calories from each macro, from what's in the plan */
export function macroSplit(n: Nutr) {
  const total = n.protein * 4 + n.carbs * 4 + n.fat * 9;
  if (!total) return { protein: 0, carbs: 0, fat: 0 };
  const protein = Math.round((n.protein * 400) / total), carbs = Math.round((n.carbs * 400) / total);
  return { protein, carbs, fat: Math.max(0, 100 - protein - carbs) }; // fat takes the rounding remainder so the three add to 100
}
/** Percent mode only makes sense when protein + carbs + fat add up to 100 */
export const pctOk = (t: Targets) => t.mode === 'g' || Math.round(t.protein + t.carbs + t.fat) === 100;

/* ---------- foods ---------- */
type Row = [number, string, number, number, number, number, number, number, number, number, [string, number][]];
export type FoodDb = { categories: string[]; foods: Row[] };
export const fromUsda = (r: Row): FoodSnap => ({
  src: 'usda', id: String(r[0]), name: r[1], base: '100g',
  n: { kcal: r[3], protein: r[4], carbs: r[5], fat: r[6], sugar: r[7], fibre: r[8], sodium: r[9] }, portions: r[10].map(([label, g]) => ({ label, g })),
});
export const fromCustom = (c: CustomFood): FoodSnap => ({
  src: 'my', id: c.id, name: c.brand ? `${c.name} (${c.brand})` : c.name, base: 'serving',
  n: { kcal: +c.kcal, protein: +c.protein, carbs: +c.carbs, fat: +c.fat, sugar: +c.sugar, fibre: +c.fibre, sodium: +c.sodium },
  portions: [{ label: c.serving_label, g: c.serving_g ?? undefined }],
});
/** Word search over USDA names; plainer (shorter) names first so "egg" finds whole eggs before egg noodles */
export function searchFoods(db: FoodDb, q: string, category: number | null = null, limit = 60): FoodSnap[] {
  const words = q.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!words.length && category === null) return [];
  const hits: [number, Row][] = [];
  for (const r of db.foods) {
    if (category !== null && r[2] !== category) continue;
    const name = r[1].toLowerCase();
    if (!words.every((w) => name.includes(w))) continue;
    const first = name.split(/[,\s]/)[0];
    const score = (words[0] && first.startsWith(words[0]) ? 0 : 1000) + name.length + (/raw/.test(name) ? 0 : 5);
    hits.push([score, r]);
  }
  return hits.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, r]) => fromUsda(r));
}
export const findUsda = (db: FoodDb, id: number) => { const r = db.foods.find((x) => x[0] === id); return r ? fromUsda(r) : null; };
