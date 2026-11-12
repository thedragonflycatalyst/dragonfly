import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { autoDurationSeconds, dueForAutoSubmit, hasProgress, lastActivity } from './auto-submit';
import type { Draft } from './session';

const H = 3_600_000;
const start = Date.UTC(2026, 10, 12, 14);
const set = (done: boolean) => ({ sets: [{ done }] }) as unknown as Draft['log'][number];
const draft = (over: Partial<Draft> = {}): Draft => ({ key: 'a:1', title: 'Legs', params: { aid: '1' }, client_id: 'c', started: start, log: [set(true), set(false)], ...over });

test('saves on its own 4 hours after the last activity, not before', () => {
  const d = draft({ touched: start + H });
  assert.equal(dueForAutoSubmit(d, start + H + 4 * H - 1), false);
  assert.equal(dueForAutoSubmit(d, start + H + 4 * H), true);
});

test('older drafts without activity times count from the start', () => {
  assert.equal(lastActivity(draft()), start);
  assert.equal(dueForAutoSubmit(draft(), start + 4 * H), true);
});

test('a workout with nothing done is never saved on its own', () => {
  const empty = draft({ log: [set(false)], touched: start });
  assert.equal(hasProgress(empty), false);
  assert.equal(dueForAutoSubmit(empty, start + 10 * H), false);
  assert.equal(hasProgress({ ...empty, timerResults: [{}] as unknown as Draft['timerResults'] }), true);
});

test('the time recorded stops at the last activity, not the idle hours', () => {
  assert.equal(autoDurationSeconds(draft({ touched: start + 50 * 60_000 })), 3000);
  assert.equal(autoDurationSeconds(draft({ touched: start + 30 * H })), 86_400);
});
