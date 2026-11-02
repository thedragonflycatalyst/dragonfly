import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeTargets, aiFood, fromItem, fromOpenFoodFacts, quickItem, showWater, toLog, totals, validBarcode, waterStep } from './diary';
import { itemNutr, NO_TARGETS, type FoodSnap } from './nutrition';

const egg: FoodSnap = { src: 'usda', id: '1', name: 'Egg', base: '100g', n: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, sugar: 0.4, fibre: 0, sodium: 142 }, portions: [{ label: '1 large', g: 50 }] };

test('logging plan foods keeps the numbers for the amount eaten', () => {
  const x = fromItem({ id: 'a', food: egg, qty: 2, portion: '1 large' });
  assert.equal(x.n.kcal, 143); assert.equal(x.name, 'Egg');
  const row = toLog(x, { client_id: 'c', eaten_on: '2026-11-01', meal: 'Breakfast', source: 'plan' });
  assert.equal(row.meal, 'Breakfast'); assert.equal(row.photo_path, null);
  assert.deepEqual(totals([row, row]), { kcal: 286, protein: 25.2, carbs: 1.4, fat: 19, sugar: 0.8, fibre: 0, sodium: 284 });
  assert.equal(totals([]).kcal, 0);
});

test('quick add needs calories, or works them out from macros', () => {
  assert.equal(quickItem('Latte', { kcal: '190' })?.n.kcal, 190);
  assert.equal(quickItem('', { protein: '20', carbs: '10', fat: '5' })?.n.kcal, 165);
  assert.equal(quickItem('', { protein: '20', carbs: '10', fat: '5' })?.name, 'Quick add');
  assert.equal(quickItem('x', {}), null);
  assert.equal(quickItem('x', { kcal: '-4' }), null);
  assert.equal(quickItem('x', { kcal: 'lots' }), null);
});

test('AI estimates become foods you can resize', () => {
  const x = aiFood({ name: 'Rice', grams: 200, kcal: 260, protein: 5.4, carbs: 56, fat: 0.6 });
  assert.equal(x.n.kcal, 260); assert.equal(x.food?.n.kcal, 130);
  assert.equal(Math.round(itemNutr({ id: 'i', food: x.food!, qty: 100, portion: 'g' }).kcal), 130);
  assert.equal(aiFood({ name: 'Sauce', grams: 0, kcal: 40, protein: 0, carbs: 2, fat: 3 }).food, null);
});

test('Open Food Facts products convert, and junk is rejected', () => {
  const f = fromOpenFoodFacts('0123456789012', { product_name: 'Protein Bar', brands: 'Acme, Other', serving_size: '60 g', serving_quantity: '60',
    nutriments: { 'energy-kcal_100g': 400, proteins_100g: 33, carbohydrates_100g: 40, fat_100g: 13, sugars_100g: 5, fiber_100g: 8, sodium_100g: 0.25 } })!;
  assert.equal(f.name, 'Protein Bar (Acme)'); assert.equal(f.n.sodium, 250); assert.equal(f.portions[0].g, 60);
  assert.equal(Math.round(itemNutr({ id: 'i', food: f, qty: 1, portion: f.portions[0].label }).kcal), 240);
  assert.equal(fromOpenFoodFacts('1', { product_name: 'Water', nutriments: {} }), null);
  assert.equal(fromOpenFoodFacts('1', null), null);
  assert.equal(Math.round(fromOpenFoodFacts('1', { nutriments: { energy_100g: 418.4 } })!.n.kcal), 100);
  assert.ok(validBarcode('012345678905')); assert.ok(!validBarcode('12ab')); assert.ok(!validBarcode('123'));
});

test('targets and water', () => {
  assert.equal(activeTargets([{ targets: NO_TARGETS }, { targets: { ...NO_TARGETS, on: true, kcal: 1800 } }])?.kcal, 1800);
  assert.equal(activeTargets([]), null);
  assert.equal(showWater(500, false), '500 ml'); assert.equal(showWater(2500, false), '2.5 L'); assert.equal(showWater(473, true), '16 fl oz');
  assert.equal(waterStep(true), 237);
});
