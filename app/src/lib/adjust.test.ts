import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adjustRoute, cleanReason, NOTICE_URL, postNotice, runAdjustment, type AdjustDeps, type FetchLike } from './adjust';

// Synthetic ids only; no real client or payment data.
const reply = (status: number, body: unknown): ReturnType<FetchLike> => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

function fakes(status = 200, body: unknown = { ok: true, message: 'Notice emailed to t***@example.test' }) {
  const calls: { kind: string; args: unknown[] }[] = [];
  const deps: AdjustDeps = {
    refundCard: (...args) => { calls.push({ kind: 'refundCard', args }); return Promise.resolve(); },
    setStatus: (...args) => { calls.push({ kind: 'setStatus', args }); return Promise.resolve(); },
    getToken: () => Promise.resolve('test-token'),
    fetchFn: (url, init) => { calls.push({ kind: 'fetch', args: [url, init] }); return reply(status, body); },
  };
  return { calls, deps };
}

test('reason is required and trimmed', () => {
  assert.equal(cleanReason(''), null);
  assert.equal(cleanReason('   '), null);
  assert.equal(cleanReason(' ok'), null);
  assert.equal(cleanReason('  Entered   twice  '), 'Entered twice');
  assert.equal(cleanReason('x'.repeat(900))?.length, 500);
});

test('routes: card refunds via Stripe, everything else is a status change; already-adjusted rows are refused', () => {
  assert.equal(adjustRoute({ method: 'stripe', status: 'paid' }, 'refund'), 'stripe');
  assert.equal(adjustRoute({ method: 'stripe', status: 'paid' }, 'void'), null); // L-022: refund it instead
  assert.equal(adjustRoute({ method: 'stripe', status: 'pending' }, 'void'), 'record');
  assert.equal(adjustRoute({ method: 'card', status: 'paid' }, 'void'), 'record');
  assert.equal(adjustRoute({ method: 'cash', status: 'paid' }, 'refund'), 'record');
  assert.equal(adjustRoute({ method: 'cash', status: 'pending' }, 'void'), 'record');
  assert.equal(adjustRoute({ method: 'cash', status: 'pending' }, 'refund'), null);
  assert.equal(adjustRoute({ method: 'cash', status: 'refunded' }, 'void'), null);
  assert.equal(adjustRoute({ method: 'stripe', status: 'void' }, 'refund'), null);
  assert.equal(adjustRoute({ method: 'cash', status: 'failed' }, 'void'), null);
});

test('card refund: Stripe refund with reason, then exactly one notice to coach-adjust', async () => {
  const { calls, deps } = fakes();
  const r = await runAdjustment({ id: 'pay-test-1', method: 'stripe', status: 'paid' }, 'refund', ' Session cancelled ', deps);
  assert.ok(r.ok && r.notice.sent);
  assert.deepEqual(calls.map((c) => c.kind), ['refundCard', 'fetch']);
  assert.deepEqual(calls[0].args, ['pay-test-1', 'Session cancelled']);
  const [url, init] = calls[1].args as [string, { method: string; headers: Record<string, string>; body: string }];
  assert.equal(url, NOTICE_URL);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(init.body), { payment_id: 'pay-test-1' });
});

test('manual refund and void: status + reason on the row (never a delete), then one notice', async () => {
  for (const [kind, status] of [['refund', 'refunded'], ['void', 'void']] as const) {
    const { calls, deps } = fakes();
    const r = await runAdjustment({ id: 'pay-test-2', method: 'cash', status: 'paid' }, kind, 'Wrong client', deps);
    assert.ok(r.ok);
    assert.deepEqual(calls.map((c) => c.kind), ['setStatus', 'fetch']);
    assert.deepEqual(calls[0].args, ['pay-test-2', status, 'Wrong client']);
  }
});

test('no change and no email without a reason, or when the change fails', async () => {
  const a = fakes();
  assert.deepEqual(await runAdjustment({ id: 'p', method: 'cash', status: 'paid' }, 'void', '  ', a.deps), { ok: false, problem: 'reason' });
  assert.equal(a.calls.length, 0);
  const b = fakes();
  b.deps.setStatus = () => Promise.reject(Object.assign(new Error('check'), { code: '23514' }));
  const r = await runAdjustment({ id: 'p', method: 'cash', status: 'paid' }, 'void', 'Entered twice', b.deps);
  assert.equal(r.ok, false);
  assert.equal(b.calls.filter((c) => c.kind === 'fetch').length, 0);
});

test('notice errors become plain lines', async () => {
  const f = (status: number, body: unknown = {}) => postNotice('p', 'tok', () => reply(status, body));
  assert.match((await f(409, { ok: false, message: 'Client has no email' })).text, /no email/);
  assert.match((await f(404)).text, /isn’t one of yours/);
  assert.match((await f(401)).text, /sign in again/);
  assert.match((await f(502)).text, /email service/);
  assert.equal((await f(200, { ok: false, message: 'nope' })).sent, false);
  assert.match((await postNotice('p', null, () => reply(200, {}))).text, /Sign in again/);
  assert.match((await postNotice('p', 'tok', () => Promise.reject(new Error('offline')))).text, /can’t reach/);
});

test('L-022: a paid Stripe payment cannot be voided, so no row change and no notice', async () => {
  const { calls, deps } = fakes();
  assert.deepEqual(await runAdjustment({ id: 'p', method: 'stripe', status: 'paid' }, 'void', 'Entered twice', deps), { ok: false, problem: 'not_allowed' });
  assert.equal(calls.length, 0);
});
