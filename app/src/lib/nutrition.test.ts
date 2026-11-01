import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baseFactor, defaultItem, fromCustom, itemNutr, macroSplit, mealNutr, pctOk, portionChoices, searchFoods, targetGrams, type CustomFood, type FoodDb, type FoodSnap } from './nutrition';
import { foods } from '../data/foods';
import { nutritionTemplates } from '../data/nutrition-templates';

const egg: FoodSnap = { src: 'usda', id: '1', name: 'Egg', base: '100g', n: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, sugar: 0.4, fibre: 0, sodium: 142 }, portions: [{ label: '1 large', g: 50 }] };

test('amounts: portions, grams, ounces', () => {
  assert.equal(baseFactor({ id: 'a', food: egg, qty: 2, portion: '1 large' }), 1);
  assert.equal(baseFactor({ id: 'a', food: egg, qty: 150, portion: 'g' }), 1.5);
  assert.equal(Math.round(itemNutr({ id: 'a', food: egg, qty: 1, portion: 'oz' }).kcal), 41);
  assert.equal(baseFactor({ id: 'a', food: egg, qty: -3, portion: 'g' }), 0);
  assert.equal(baseFactor({ id: 'a', food: egg, qty: 1, portion: 'nope' }), 0);
  assert.deepEqual(portionChoices(egg), ['1 large', 'g', 'oz']);
  assert.equal(defaultItem(egg).portion, '1 large');
  assert.equal(defaultItem({ ...egg, portions: [{ label: '1 cup, mashed', g: 225 }, { label: '1 medium (7" to 7-7/8" long)', g: 118 }] }).portion, '1 medium (7" to 7-7/8" long)');
  assert.equal(defaultItem({ ...egg, portions: [] }).portion, 'g');
});

test('custom foods count per serving, and by weight when the serving weight is known', () => {
  const c: CustomFood = { id: 'x', trainer_id: 't', name: 'Bar', brand: 'Acme', serving_label: '1 bar', serving_g: 60, kcal: 240, protein: 20, carbs: 24, fat: 8, sugar: 4, fibre: 3, sodium: 150, archived: false };
  const f = fromCustom(c);
  assert.equal(f.name, 'Bar (Acme)');
  assert.equal(itemNutr({ id: 'a', food: f, qty: 2, portion: '1 bar' }).kcal, 480);
  assert.equal(itemNutr({ id: 'a', food: f, qty: 30, portion: 'g' }).kcal, 120);
  const noWeight = fromCustom({ ...c, serving_g: null });
  assert.deepEqual(portionChoices(noWeight), ['1 bar']);
  assert.equal(mealNutr({ id: 'm', name: 'Snack', items: [{ id: 'a', food: noWeight, qty: 1.5, portion: '1 bar' }] }).protein, 30);
});

test('targets in percent become grams; split adds up', () => {
  const g = targetGrams({ on: true, mode: 'pct', kcal: 2000, protein: 30, carbs: 40, fat: 30, sugar: 50, fibre: 30, sodium: 2300 });
  assert.equal(g.protein, 150); assert.equal(g.carbs, 200); assert.equal(g.fat, 66.7); assert.equal(g.sugar, 50);
  assert.ok(pctOk({ on: true, mode: 'pct', kcal: 0, protein: 30, carbs: 40, fat: 30, sugar: 0, fibre: 0, sodium: 0 }));
  assert.ok(!pctOk({ on: true, mode: 'pct', kcal: 0, protein: 30, carbs: 40, fat: 20, sugar: 0, fibre: 0, sodium: 0 }));
  const s = macroSplit({ kcal: 0, protein: 100, carbs: 100, fat: 44.4, sugar: 0, fibre: 0, sodium: 0 });
  assert.equal(s.protein + s.carbs + s.fat, 100);
  assert.deepEqual(macroSplit({ kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fibre: 0, sodium: 0 }), { protein: 0, carbs: 0, fat: 0 });
});

test('USDA search finds plain foods first and respects categories', () => {
  const db: FoodDb = foods();
  assert.ok(db.foods.length > 7000);
  const egg1 = searchFoods(db, 'egg whole')[0];
  assert.match(egg1.name, /^Egg, whole/);
  assert.match(searchFoods(db, 'banana')[0].name, /^Bananas?, raw/);
  assert.equal(searchFoods(db, '').length, 0);
  const fruit = db.categories.indexOf('Fruits and Fruit Juices');
  assert.ok(searchFoods(db, '', fruit, 500).every((f) => db.foods.find((r) => String(r[0]) === f.id)![2] === fruit));
});

test('templates resolve every food and have sensible totals', () => {
  for (const t of nutritionTemplates()) {
    assert.ok(t.meals.every((m) => m.items.every((i) => i.food.n.kcal >= 0)), t.name);
    assert.ok(t.targets.kcal >= 1300 && t.targets.kcal <= 2600, `${t.name}: ${t.targets.kcal}`);
    assert.ok(t.targets.protein >= 60, t.name);
  }
});
