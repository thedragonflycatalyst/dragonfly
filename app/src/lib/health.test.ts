import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyTotals, emptyHealth, foodRows, healthSignals, mergeDaily, parseFoodCsv } from './health';

test('daily totals: steps add up, sleep lands on the wake-up day, heart rate averages', () => {
  const h = emptyHealth();
  h.steps.push({ start: '2026-11-05T09:00:00', end: '2026-11-05T10:00:00', count: 3000 }, { start: '2026-11-05T15:00:00', end: '2026-11-05T16:00:00', count: 4500 });
  h.sleep.push({ start: '2026-11-04T23:30:00', end: '2026-11-05T06:45:00' });
  h.restingHr.push({ time: '2026-11-05T07:00:00', bpm: 58 }, { time: '2026-11-05T19:00:00', bpm: 62 });
  h.water.push({ start: '2026-11-05T12:00:00', ml: 500 }, { start: '2026-11-05T14:00:00', ml: 750 });
  const d = dailyTotals(h);
  assert.equal(d.length, 1);
  assert.deepEqual(d[0], { day: '2026-11-05', steps: 7500, sleep_min: 435, water_ml: 1250, resting_hr: 60 });
  assert.deepEqual(mergeDaily({ day: '2026-11-05', steps: 9000, readiness: 80 }, d[0]).steps, 9000);
});

test('synced food becomes diary rows with stable ids', () => {
  const rows = foodRows({ food: [{ id: 'x1', start: '2026-11-01T12:30:00', meal: 'Lunch', name: 'Chicken bowl', kcal: 640.4, protein: 48.26, app: 'MyFitnessPal' }] }, 'hc');
  assert.equal(rows[0].external_id, 'hc:x1'); assert.equal(rows[0].n.kcal, 640); assert.equal(rows[0].n.protein, 48.3); assert.equal(rows[0].note, 'From MyFitnessPal');
});

test('food CSV: Cronometer servings, MyFitnessPal meals', () => {
  const c = parseFoodCsv('Day,Time,Group,Food Name,Amount,Energy (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g),Sugars (g),Sodium (mg)\n2026-11-01,08:10,Breakfast,"Oats, rolled",40 g,150,5.3,27,2.7,4,0.4,2\n2026-11-01,,Dinner,Salmon,150 g,310,30,0,20,0,0,90\n');
  assert.equal(c.app, 'Cronometer'); assert.equal(c.rows.length, 2);
  assert.equal(c.rows[0].name, 'Oats, rolled, 40 g'); assert.equal(c.rows[0].meal, 'Breakfast'); assert.equal(c.rows[1].meal, 'Dinner'); assert.equal(c.rows[1].sodium, 90);
  const m = parseFoodCsv('Date,Meal,Calories,Fat (g),Carbohydrates (g),Fiber,Sugar,Protein (g)\n2026-10-30,Lunch,620,18,70,8,6,45\n10/31/2026,Snacks,180,7,20,2,12,8\nTotal,,800\n');
  assert.equal(m.app, 'MyFitnessPal'); assert.equal(m.rows.length, 2); assert.equal(m.skipped, 1);
  assert.equal(m.rows[0].name, 'Lunch (MyFitnessPal)'); assert.equal(m.rows[1].start.slice(0, 7), '2026-10');
});

test('health signals for check-ins', () => {
  const days = Array.from({ length: 28 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, steps: i >= 21 ? 4000 : 9000, sleep_min: i >= 21 ? 320 : 450, resting_hr: i >= 21 ? 66 : 58 }));
  const s = healthSignals(days, '2026-10-28').map((x) => x.text);
  assert.deepEqual(s, ['Sleeping 5h 20m a night', 'Steps down 56% this week', 'Resting heart rate up 8 bpm']);
});
