import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bmi, bmiClass, byMonth, changeOver, chartValue, weightRulerValue, fmtMetric, fmtNum, goalEta, kcalPerDay, monthlyChange, parseCsv, ratePerWeek, spanText, toKgFrom, fromKg, trend, valueOf, yearlyChange, type Weighin } from './scale';
import { occurrences, openSlots, priceLabel, toCents, voucherPrice, voucherState, weekOf, spotsText, eventCost, byMonth as moneyByMonth, type Booking } from './business';
import { bigEmoji, layout, linkify, seenBy, tally, chatName, type Message, type ChatMember } from './chat';
import { unitPrefs, notifyPrefs } from './prefs';

const W = (d: string, kg: number, metrics: Weighin['metrics'] = {}): Weighin => ({ id: d, user_id: 'u', measured_at: new Date(d).toISOString(), weight_kg: kg, metrics, source: 'manual', note: null });

test('units and number formats', () => {
  assert.equal(Math.round(fromKg(111.04, 'lb') * 10) / 10, 244.8);
  assert.equal(Math.round(toKgFrom(14, 'st') * 100) / 100, 88.9);
  assert.equal(fmtNum(1200.5, 2), '1,200.50');
  assert.equal(fmtNum(1200.5, 2, 'comma'), '1.200,50');
  assert.equal(fmtNum(-3.25, 1), '−3.3');
});

test('weight ruler snaps tenths and respects weight limits for all units', () => {
  assert.equal(weightRulerValue(244.84, 'lb'), 244.8);
  assert.equal(weightRulerValue(244.86, 'lb'), 244.9);
  assert.equal(weightRulerValue(-100, 'kg'), 20);
  assert.equal(weightRulerValue(900, 'kg'), 400);
  assert.equal(weightRulerValue(0, 'st'), Math.ceil(fromKg(20, 'st') * 10) / 10);
  assert.equal(weightRulerValue(1000, 'lb'), Math.floor(fromKg(400, 'lb') * 10) / 10);
});

test('derived values: lean, fat and muscle mass from percentages', () => {
  const w = W('2026-10-30', 111.04, { body_fat_pct: 30.2, muscle_pct: 36.9 });
  assert.equal(Math.round(fromKg(valueOf(w, 'lean_mass')!, 'lb') * 10) / 10, 170.9);
  assert.equal(Math.round(fromKg(chartValue(w, 'muscle_pct')!, 'lb') * 10) / 10, 90.3);
  assert.equal(valueOf(W('2026-10-30', 80), 'lean_mass'), null);
  assert.equal(fmtMetric('body_fat_pct', 30.2, 'lb'), '30.2 %');
  assert.equal(fmtMetric('weight', 111.04, 'lb'), '244.8 lbs');
  assert.equal(fmtMetric('bmr_kcal', 2150.4, 'lb'), '2,150 kcal');
});

test('BMI and its class', () => {
  const b = bmi(111.04, 180.3);
  assert.equal(Math.round(b * 10) / 10, 34.2);
  assert.equal(bmiClass(b), 'Obese class I');
  assert.equal(bmiClass(22), 'Healthy');
});

test('trend smooths day-to-day swings and gives a weekly rate', () => {
  const list = Array.from({ length: 29 }, (_, i) => W(`2026-10-${String(i + 1).padStart(2, '0')}T08:00:00`, 100 - i * 0.1 + (i % 2 ? 0.8 : -0.8)));
  const tr = trend(list);
  assert.equal(tr.length, 29);
  const swing = Math.max(...tr.slice(10).map((p, i, a) => (i ? Math.abs(p.trend - a[i - 1].trend) : 0)));
  assert.ok(swing < 0.25, 'trend moves far less than the raw weight');
  const rate = ratePerWeek(tr)!;
  assert.ok(rate < -0.3 && rate > -1, `losing roughly 0.7 kg a week (got ${rate})`);
  assert.ok(kcalPerDay(rate) < -300);
  assert.equal(ratePerWeek(trend([W('2026-10-01', 80)])), null);
});

test('goal projection: only when heading the right way', () => {
  const from = new Date('2026-11-01T12:00:00Z');
  assert.equal(goalEta(100, 90, -1, from)!.toISOString().slice(0, 10), '2027-01-10');
  assert.equal(goalEta(100, 90, 0.5, from), null);
  assert.equal(goalEta(100, 90, null, from), null);
  assert.equal(goalEta(90.01, 90, 0.5, from), from);
});

test('change over periods, monthly and yearly, and month groups', () => {
  const list = [W('2025-12-15', 110), W('2026-01-15', 108), W('2026-02-15', 106), W('2026-03-15', 107)];
  const tr = trend(list, 1);  // no smoothing so numbers are easy
  assert.equal(Math.round(changeOver(tr, 30)!.kg), 1);
  assert.equal(changeOver(tr, 365), null);
  assert.deepEqual(monthlyChange(tr).map((m) => Math.round(m.kg)), [-2, -2, 1]);
  assert.deepEqual(yearlyChange(tr).map((y) => [y.year, Math.round(y.kg)]), [[2025, 0], [2026, -1]]);
  const g = byMonth(list);
  assert.equal(g[0].month, '2026-03'); assert.equal(g[0].change, 1); assert.equal(g.length, 4);
  assert.equal(spanText(list), '3 months');
});

test('CSV import: Libra export', () => {
  const csv = '#Version:6\n#Units:lb\n\n#date;weight;weight trend;body fat;body fat trend;muscle mass;muscle mass trend;log\n2026-10-30T15:20:00.000Z;244.8;242.1;30.2;30.0;36.9;37.0;\n2026-10-29T00:32:00.000Z;244.2;241.8;;;;;\nbad;row\n';
  const { rows, skipped } = parseCsv(csv);
  assert.equal(rows.length, 2); assert.equal(skipped, 1);
  assert.equal(rows[0].measured_at, '2026-10-30T15:20:00.000Z');
  assert.equal(Math.round(fromKg(rows[0].weight_kg, 'lb') * 10) / 10, 244.8);
  assert.deepEqual(rows[0].metrics, { body_fat_pct: 30.2, muscle_pct: 36.9 });
  assert.deepEqual(rows[1].metrics, {});
});

test('CSV import: RENPHO export with masses in pounds', () => {
  const csv = 'Time of Measurement,Weight(lb),BMI,Body Fat(%),Fat-free Body Weight(lb),Subcutaneous Fat(%),Visceral Fat,Body Water(%),Skeletal Muscle(%),Muscle Mass(lb),Bone Mass(lb),Protein (%),BMR(kcal),Metabolic Age\n"10/30/2026, 11:20 PM",244.8,34.1,30.2,170.9,26.1,14,50.2,45.3,90.3,9.1,16.4,2010,48\n';
  const { rows } = parseCsv(csv, 'kg');
  assert.equal(rows.length, 1);
  const m = rows[0].metrics;
  assert.equal(m.body_fat_pct, 30.2); assert.equal(m.visceral_fat, 14); assert.equal(m.body_water_pct, 50.2);
  assert.equal(m.muscle_pct, 36.9); assert.equal(m.bone_mass_kg, 4.1); assert.equal(m.bmr_kcal, 2010); assert.equal(m.metabolic_age, 48);
  assert.equal(new Date(rows[0].measured_at).getHours(), 23);
});

test('calendar: repeating sessions, skips and week strip', () => {
  const b: Booking = { id: 'b', trainer_id: 't', client_id: 'c', group_id: null, title: 'PT', kind: 'session', location: null, starts_at: new Date('2026-10-05T09:00:00').toISOString(),
    duration_min: 60, repeat: 'weekly', repeat_until: '2026-11-30', skipped: ['2026-11-09'], done: ['2026-11-02'], notes: null, color: null, booked_by: 'trainer' };
  const occ = occurrences([b], '2026-11-01', '2026-11-30');
  assert.deepEqual(occ.map((o) => o.day), ['2026-11-02', '2026-11-16', '2026-11-23', '2026-11-30']);
  assert.equal(occ[0].done, true);
  assert.equal(occ[0].start.getHours(), 9);
  const once = { ...b, id: 'o', repeat: 'none' as const };
  assert.equal(occurrences([once], '2026-11-01', '2026-11-30').length, 0);
  const monthly = { ...b, repeat: 'monthly' as const, starts_at: new Date('2026-01-31T09:00:00').toISOString(), repeat_until: null };
  assert.deepEqual(occurrences([monthly], '2026-01-01', '2026-05-31').map((o) => o.day), ['2026-01-31', '2026-03-31', '2026-05-31']);
  assert.deepEqual(weekOf(new Date('2026-11-04T12:00:00')), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
});

test('open slots skip busy times and the next hour', () => {
  const avail = [{ id: 'a', trainer_id: 't', weekday: 3, start_time: '09:00:00', end_time: '12:00:00' }];
  const busy = [{ start: new Date('2026-11-04T10:00:00'), end: new Date('2026-11-04T11:00:00') }];
  const s = openSlots('2026-11-04', 60, avail, busy, new Date('2026-11-01T00:00:00'));
  assert.deepEqual(s.map((d) => d.getHours() + d.getMinutes() / 60), [9, 11]);
});

test('money: prices, vouchers and monthly totals', () => {
  assert.equal(toCents('$1,250.5'), 125050); assert.equal(toCents('abc'), null);
  assert.equal(priceLabel({ price_cents: 0, currency: 'usd', billing: 'once' }), 'Free');
  assert.match(priceLabel({ price_cents: 9900, currency: 'usd', billing: 'month' }), /99\/mo$/);
  assert.equal(voucherPrice(10000, { percent_off: 15, amount_off_cents: null }), 8500);
  assert.equal(voucherPrice(1000, { percent_off: null, amount_off_cents: 2000 }), 0);
  const v = { id: 'v', trainer_id: 't', code: 'X', description: null, percent_off: 10, amount_off_cents: null, package_ids: [], max_uses: 2, uses: 2, expires_on: null, active: true };
  assert.equal(voucherState(v), 'used up'); assert.equal(voucherState({ ...v, uses: 0, expires_on: '2020-01-01' }), 'expired');
  const m = moneyByMonth([{ amount_cents: 5000, status: 'paid', paid_at: '2026-10-03T12:00:00' }, { amount_cents: 2000, status: 'refunded', paid_at: '2026-10-04T12:00:00' }], 2, new Date('2026-11-02T12:00:00'));
  assert.deepEqual(m, [{ month: '2026-10', gross: 5000, count: 1 }, { month: '2026-11', gross: 0, count: 0 }]);
  assert.equal(spotsText({ spaces: 10, booked: 10, waitlist: true, waiting: 2 }), 'Full · 2 on the waiting list');
  assert.match(eventCost({ price_cents: 2500, currency: 'usd', credits: 1 }), /25 or 1 credit$/);
});

test('chat helpers', () => {
  const m = (id: string, sender: string, at: string): Message => ({ id, chat_id: 'c', sender, kind: 'text', body: 'hi', path: null, meta: {}, reply_to: null, broadcast_id: null, edited_at: null, deleted_at: null, created_at: at });
  const l = layout([m('1', 'a', '2026-07-16T19:27:00Z'), m('2', 'a', '2026-07-16T19:28:00Z'), m('3', 'b', '2026-07-18T19:56:00Z')]);
  assert.deepEqual(l.map((x) => x.type), ['day', 'msg', 'msg', 'day', 'msg']);
  assert.deepEqual(l.filter((x) => x.type === 'msg').map((x) => (x as { first: boolean }).first), [true, false, true]);
  const members: ChatMember[] = [{ chat_id: 'c', user_id: 'a', role: 'trainer', name: 'Dragonfly', muted: false, archived: false, last_read_at: '2026-07-18T00:00:00Z' },
    { chat_id: 'c', user_id: 'b', role: 'client', name: 'David Allen', muted: false, archived: false, last_read_at: '2026-07-17T00:00:00Z' }];
  assert.equal(seenBy(m('1', 'a', '2026-07-16T19:27:00Z'), members, 'a'), true);
  assert.equal(seenBy(m('4', 'a', '2026-07-18T19:27:00Z'), members, 'a'), false);
  assert.equal(chatName({ id: 'c', trainer_id: 'a', kind: 'direct', title: null, created_by: 'a', last_message_at: null, last_preview: null, created_at: '' }, members, 'a'), 'David Allen');
  assert.deepEqual(tally([{ message_id: '1', user_id: 'a', emoji: '🔥' }, { message_id: '1', user_id: 'b', emoji: '🔥' }], '1', 'b'), [{ emoji: '🔥', n: 2, mine: true }]);
  assert.deepEqual(linkify('see https://x.com/a. ok').map((p) => p.url ?? p.text), ['see ', 'https://x.com/a', '. ok']);
  assert.equal(bigEmoji('🔥💪'), true); assert.equal(bigEmoji('ok 🔥'), false); assert.equal(bigEmoji('123'), false);
});

test('preferences fill in defaults', () => {
  assert.deepEqual(unitPrefs('imperial', { distance: 'km' }), { weights: 'lb', bodyweight: 'lb', length: 'in', height: 'ft', distance: 'km', number: 'dot' });
  assert.equal(unitPrefs('metric').bodyweight, 'kg');
  const n = notifyPrefs({ messages: { push: false, email: true } });
  assert.deepEqual(n.messages, { push: false, email: true }); assert.equal(n.payments.email, true); assert.equal(n.quiet!.on, false);
});

test('Health Connect: readings pair with their weigh-in, duplicates are skipped', async () => {
  const { mergeHealth } = await import('./scale');
  const rows = mergeHealth({
    weight: [{ time: '2026-10-30T23:20:00Z', kg: 111.04 }, { time: '2026-10-29T20:32:00Z', kg: 110.8 }, { time: '2026-10-28T08:00:00Z', kg: 110 }],
    bodyFat: [{ time: '2026-10-30T23:20:05Z', pct: 30.2 }],
    leanMass: [{ time: '2026-10-29T20:32:00Z', kg: 77.8 }],
    boneMass: [{ time: '2026-10-30T23:20:00Z', kg: 4.1 }],
    bodyWater: [{ time: '2026-10-30T23:20:00Z', kg: 55.7 }],
    bmr: [{ time: '2026-10-30T23:21:00Z', kcal: 2010 }, { time: '2026-10-28T09:00:00Z', kcal: 1990 }],
  }, [{ measured_at: '2026-10-28T08:02:00Z' }]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].metrics, { body_fat_pct: 30.2, bone_mass_kg: 4.1, body_water_pct: 50.2, bmr_kcal: 2010 });
  assert.equal(rows[1].metrics.body_fat_pct, 29.8);  // worked out from lean mass
});
