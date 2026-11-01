import { blankMeals, findUsda, newId, planNutr, round, type Meal, type Targets } from '@/lib/nutrition';
import { foods } from './foods';

// Starter meal plans built from USDA foods (amounts in grams). Dragonfly's own examples, not medical advice.
type Spec = { key: string; name: string; cover: string; description: string; meals: Record<string, [number, number][]> };
const SPECS: Spec[] = [
  { key: 'high-protein', name: 'High-Protein Day', cover: 'preset:0', description: 'Whole-food day built around lean protein at every meal. A starting point for building muscle or holding onto it while leaning out.',
    meals: {
      Breakfast: [[172187, 150], [172688, 64], [171711, 100]],
      Lunch: [[171477, 170], [168878, 200], [169967, 150], [171413, 10]],
      Dinner: [[175168, 170], [168483, 200], [168462, 60]],
      Snacks: [[170894, 200], [170567, 28], [173944, 118]],
      Drinks: [[174158, 1000]],
    } },
  { key: 'lean', name: 'Lean and Simple', cover: 'preset:3', description: 'A lighter day with simple meals and plenty of vegetables. Adjust portions to the client’s calorie target.',
    meals: {
      Breakfast: [[173904, 40], [171267, 244], [171711, 75]],
      Lunch: [[173709, 120], [172688, 64], [168462, 60], [171705, 50]],
      Dinner: [[174752, 113], [168917, 140], [169967, 150]],
      Snacks: [[172182, 113], [171688, 180]],
      Drinks: [[174158, 1000], [171890, 237]],
    } },
  { key: 'plant', name: 'Plant-Based Day', cover: 'preset:5', description: 'Meat-free day using lentils, beans, tofu and whole grains to hit protein.',
    meals: {
      Breakfast: [[173904, 60], [173944, 118], [172470, 32]],
      Lunch: [[172421, 200], [168917, 185], [168462, 60], [171413, 10]],
      Dinner: [[172475, 200], [173735, 172], [168878, 150], [169967, 150]],
      Snacks: [[170567, 28], [171688, 180]],
      Drinks: [[174158, 1000]],
    } },
];

export type NutritionTemplate = { key: string; name: string; cover: string; description: string; meals: Meal[]; targets: Targets };
/** Builds templates on first use (needs the food database) */
export function nutritionTemplates(): NutritionTemplate[] {
  const db = foods();
  return SPECS.map((s) => {
    const meals = blankMeals().map((m) => ({ ...m, items: (s.meals[m.name] ?? []).map(([id, g]) => {
      const food = findUsda(db, id);
      if (!food) throw new Error(`template food ${id} missing`);
      return { id: newId(), food, qty: g, portion: 'g' };
    }) }));
    const n = round(planNutr(meals));
    return { key: s.key, name: s.name, cover: s.cover, description: s.description, meals,
      targets: { on: true, mode: 'g', kcal: Math.round(n.kcal / 50) * 50, protein: Math.round(n.protein), carbs: Math.round(n.carbs), fat: Math.round(n.fat), sugar: 0, fibre: Math.round(n.fibre), sodium: 0 } };
  });
}
