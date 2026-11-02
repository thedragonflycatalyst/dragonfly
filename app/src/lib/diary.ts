// Food diary: what a client actually ate, plus water. Pure helpers (tested).
import { itemNutr, round, ZERO, type FoodSnap, type MealItem, type Nutr, type NutritionPlan, type Targets } from './nutrition';

export const DIARY_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
export type LogSource = 'search' | 'plan' | 'barcode' | 'quick' | 'photo' | 'ai' | 'saved';
export type FoodLog = {
  id: string; client_id: string; trainer_id: string; user_id: string; eaten_on: string; meal: string; name: string;
  food: FoodSnap | null; qty: number | null; portion: string | null; n: Nutr; source: LogSource; photo_path: string | null; note: string | null; created_at: string;
};
export type NewLog = Omit<FoodLog, 'id' | 'trainer_id' | 'user_id' | 'created_at'>;
export type SavedMeal = { id: string; client_id: string; name: string; items: NewLogItem[]; created_at: string };
/** What a saved meal remembers about each food */
export type NewLogItem = Pick<FoodLog, 'name' | 'food' | 'qty' | 'portion' | 'n'>;

export const fromItem = (i: MealItem): NewLogItem => ({ name: i.food.name, food: i.food, qty: i.qty, portion: i.portion, n: round(itemNutr(i)) });
export const toLog = (x: NewLogItem, at: { client_id: string; eaten_on: string; meal: string; source: LogSource }, extra: Partial<NewLog> = {}): NewLog =>
  ({ ...at, name: x.name.slice(0, 200), food: x.food, qty: x.qty, portion: x.portion, n: x.n, photo_path: null, note: null, ...extra });

const sum = (a: Nutr, b: Partial<Nutr>): Nutr => {
  const out = { ...a };
  for (const k of Object.keys(ZERO) as (keyof Nutr)[]) out[k] = a[k] + (Number(b[k]) || 0);
  return out;
};
export const totals = (logs: Pick<FoodLog, 'n'>[]) => round(logs.reduce((t, l) => sum(t, l.n), ZERO));

/** Quick add: just a name and numbers */
export function quickItem(name: string, values: Partial<Record<keyof Nutr, string>>): NewLogItem | null {
  const n = { ...ZERO };
  for (const k of Object.keys(ZERO) as (keyof Nutr)[]) {
    const t = (values[k] ?? '').trim().replace(',', '.');
    if (t === '') continue;
    const v = Number(t);
    if (!Number.isFinite(v) || v < 0 || v > 100000) return null;
    n[k] = v;
  }
  if (!n.kcal && (n.protein || n.carbs || n.fat)) n.kcal = Math.round(n.protein * 4 + n.carbs * 4 + n.fat * 9);
  if (!n.kcal) return null;
  return { name: name.trim() || 'Quick add', food: null, qty: null, portion: null, n: round(n) };
}

/** AI photo estimate → diary items (amounts in grams, numbers for the whole portion) */
export type AiItem = { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number; sugar?: number; fibre?: number; sodium?: number };
export const fromAi = (a: AiItem): NewLogItem => ({
  name: a.name, qty: a.grams || null, portion: a.grams ? 'g' : null,
  food: a.grams ? { src: 'my', id: 'ai', name: a.name, base: '100g', n: round({ kcal: a.kcal, protein: a.protein, carbs: a.carbs, fat: a.fat, sugar: a.sugar ?? 0, fibre: a.fibre ?? 0, sodium: a.sodium ?? 0 }), portions: [] } : null,
  n: round({ kcal: a.kcal, protein: a.protein, carbs: a.carbs, fat: a.fat, sugar: a.sugar ?? 0, fibre: a.fibre ?? 0, sodium: a.sodium ?? 0 }),
});
// The AI's food snapshot holds totals for its portion, so rescale it to per-100 g for later amount changes
export function aiFood(a: AiItem): NewLogItem {
  const x = fromAi(a);
  if (x.food && a.grams > 0) x.food = { ...x.food, n: round(Object.fromEntries(Object.entries(x.n).map(([k, v]) => [k, (v * 100) / a.grams])) as Nutr) };
  return x;
}

/** Open Food Facts product → a food (per 100 g), or null when it has no calorie data */
type Off = { product_name?: string; brands?: string; serving_size?: string; serving_quantity?: number | string; nutriments?: Record<string, number | string> };
export function fromOpenFoodFacts(code: string, p: Off | null | undefined): FoodSnap | null {
  if (!p?.nutriments) return null;
  const v = (k: string) => { const x = Number(p.nutriments?.[k]); return Number.isFinite(x) && x >= 0 ? x : 0; };
  const kcal = v('energy-kcal_100g') || (v('energy_100g') ? v('energy_100g') / 4.184 : 0);
  if (!kcal) return null;
  const name = [p.product_name?.trim(), p.brands?.split(',')[0]?.trim()].filter(Boolean).join(' (') + (p.brands && p.product_name ? ')' : '');
  const g = Number(p.serving_quantity);
  return {
    src: 'my', id: `off:${code}`, name: name || `Barcode ${code}`, base: '100g',
    n: round({ kcal, protein: v('proteins_100g'), carbs: v('carbohydrates_100g'), fat: v('fat_100g'), sugar: v('sugars_100g'), fibre: v('fiber_100g'), sodium: v('sodium_100g') * 1000 }),
    portions: g > 0 ? [{ label: `1 serving (${p.serving_size?.trim() || `${g} g`})`.slice(0, 60), g }] : [],
  };
}
export const validBarcode = (s: string) => /^\d{8,14}$/.test(s.trim());

/** The targets a client is working to: the newest shared plan that has targets switched on */
export const activeTargets = (plans: Pick<NutritionPlan, 'targets'>[]): Targets | null => plans.find((x) => x.targets?.on)?.targets ?? null;

/** Water: stored in ml, shown in fl oz for imperial */
export const ML_PER_OZ = 29.5735;
export const showWater = (ml: number, imperial: boolean) => (imperial ? `${Math.round(ml / ML_PER_OZ)} fl oz` : ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${ml} ml`);
export const waterStep = (imperial: boolean) => (imperial ? Math.round(8 * ML_PER_OZ) : 250);
export const WATER_GOAL_ML = 2500;
