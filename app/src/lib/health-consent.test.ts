import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONSENT_VERSION, exportCsv, exportJson, grantConsent, hasConsent, noConsent, toCsv, withdrawConsent } from './health-consent';

const T0 = new Date('2026-11-01T10:00:00Z');
const T1 = new Date('2026-11-02T10:00:00Z');

test('no read without an explicit, current yes', () => {
  assert.equal(hasConsent(undefined), false);
  assert.equal(hasConsent(null), false);
  assert.equal(hasConsent(noConsent()), false, 'declining (never granting) means no');
  assert.equal(hasConsent(grantConsent(T0)), true);
  assert.equal(hasConsent({ ...grantConsent(T0), version: CONSENT_VERSION - 1 }), false, 'older consent text asks again');
});

test('withdrawing stops reads; granting again resumes', () => {
  const c = grantConsent(T0);
  const w = withdrawConsent(c, T1);
  assert.equal(hasConsent(w), false);
  assert.equal(w.granted_at, c.granted_at, 'keeps when it was granted');
  assert.equal(w.withdrawn_at, T1.toISOString());
  assert.equal(hasConsent(withdrawConsent(null, T1)), false);
  assert.equal(hasConsent(grantConsent(new Date('2026-11-03T00:00:00Z'))), true);
});

const DATA = {
  daily: [{ day: '2026-11-01', steps: 8000, sources: ['health_connect'] }, { day: '2026-11-02', sleep_min: 420 }],
  activities: [{ kind: 'Running', name: 'Easy, "slow" run\nwith hills', started_at: '2026-11-01T07:00:00Z' }],
  weighins: [{ measured_at: '2026-11-01T06:00:00Z', weight_kg: 80.5, note: '=HYPERLINK("x")' }],
  food: [],
};

test('JSON export holds every section and the consent record', () => {
  const j = JSON.parse(exportJson(DATA, grantConsent(T0), T1));
  assert.equal(j.exported_at, T1.toISOString());
  assert.equal(j.consent.granted_at, T0.toISOString());
  assert.deepEqual(j.daily, DATA.daily);
  assert.deepEqual(j.activities, DATA.activities);
  assert.deepEqual(j.weighins, DATA.weighins);
  assert.deepEqual(j.food, []);
});

test('CSV export: union of columns, quoting, formula guard', () => {
  assert.equal(toCsv(DATA.daily), 'day,steps,sources,sleep_min\n2026-11-01,8000,"[""health_connect""]",\n2026-11-02,,,420');
  assert.equal(toCsv(DATA.activities).split('\n').length, 3, 'newline inside a quoted cell');
  assert.match(toCsv(DATA.activities), /"Easy, ""slow"" run\nwith hills"/);
  assert.match(toCsv(DATA.weighins), /"'=HYPERLINK\(""x""\)"/, 'formulas are neutralised');
  assert.equal(toCsv([{ v: -3.5 }]), 'v\n-3.5', 'negative numbers stay numbers');
  const all = exportCsv(DATA);
  for (const s of ['# daily', '# activities', '# weighins', '# food']) assert.ok(all.includes(s), s);
  assert.equal(toCsv([]), '');
});
