import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { emptyDraft, hasContent, isOpen, KIND_LABEL, refLabel, REPORT_CATEGORIES, reportPayload, revisionOf, STATUS_LABEL } from './exercise-report';

const ctx = { ref: 'lib:c-goblet-squat', name: 'Goblet Squat', variant: 'Dumbbell', revision: 'abc', screen: 'session', appVersion: '1.0.0' };

test('the categories the beta asked for, and labels for older reports', () => {
  assert.equal(REPORT_CATEGORIES.length, 8);
  for (const k of ['redundant', 'wrong_video', 'unclear', 'unsafe', 'instructions']) assert.ok(KIND_LABEL[k]);
});

test('a report carries the exercise context; the tester never types which exercise', () => {
  const d = { ...emptyDraft('k1'), kind: 'instructions' as const, note: '  Step 2 is wrong  ', expected: 'Hold at chest' };
  const p = reportPayload(d, ctx, null);
  assert.equal(p.ref, 'lib:c-goblet-squat'); assert.equal(p.client_key, 'k1'); assert.equal(p.note, 'Step 2 is wrong');
  assert.equal(p.variant, 'Dumbbell'); assert.equal(p.screen, 'session'); assert.equal(p.screenshot_path, '');
});

test('a category is required, and "something else" needs words', () => {
  assert.throws(() => reportPayload(emptyDraft('k'), ctx, null), /Choose/);
  assert.throws(() => reportPayload({ ...emptyDraft('k'), kind: 'other' }, ctx, null), /Say what/);
});

test('drafts, revisions, statuses', () => {
  assert.equal(hasContent(emptyDraft('k')), false);
  assert.equal(hasContent({ ...emptyDraft('k'), note: 'x' }), true);
  assert.equal(revisionOf({ a: 1 }), revisionOf({ a: 1 }));
  assert.notEqual(revisionOf({ a: 1 }), revisionOf({ a: 2 }));
  assert.match(revisionOf(['x', 'y']), /^[a-z0-9]{1,40}$/);
  assert.equal(STATUS_LABEL.reviewing, 'Under review');
  assert.ok(isOpen('open') && isOpen('reviewing') && !isOpen('released'));
  assert.equal(refLabel(42), 'R-42');
});
