import assert from 'node:assert/strict';
import { test } from 'node:test';
import { admit, crashReport, DAILY_LIMIT, scrubMessage, scrubRoute, scrubStack, signature } from './crash';

// Synthetic person and data: none of it may reach a report
const NAME = 'Jane Testperson';
const EMAIL = 'jane.test@example.com';
const PHONE = '+1 (555) 010-4477';
const ID = '3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl';
const CARD = '4242 4242 4242 4242';
const META = { fatal: true, platform: 'android', version: '1.0.0', route: `/clients/${ID}/scale?email=${EMAIL}` };

function leaky() {
  const e = new TypeError(`Cannot save "${NAME}" <${EMAIL}> phone ${PHONE} weight 81.4 kg paid $60.00 card ${CARD} id ${ID} token ${JWT} key sk_test_abcdefghijklmnop`);
  e.stack = [
    `TypeError: ${e.message}`,
    '    at saveClient (index.android.bundle:1:2345678)',
    `    at fetch (https://example.test/rest/v1/coach_clients?id=eq.${ID}&email=${EMAIL}:2:10)`,
    `    at onPress (index.android.bundle:1:99) "${NAME}"`,
    'not a frame: free text about Jane',
  ].join('\n');
  return e;
}

test('a report never carries names, emails, phones, ids, tokens, health or payment values', () => {
  const r = crashReport(leaky(), META);
  const all = JSON.stringify(r);
  for (const bad of [NAME, 'Jane', EMAIL, PHONE, '555', ID, JWT, CARD, '4242', '81.4', '60.00', 'sk_test_abcdefghijklmnop', 'free text']) {
    assert.ok(!all.includes(bad), `leaked ${bad}`);
  }
  assert.ok(r.body.startsWith('[crash] TypeError: Cannot save "…"'));
  assert.equal(r.context.screen, '/clients/[id]/scale');
  assert.equal(r.context.kind, 'crash');
  assert.equal(r.context.fatal, true);
});

test('stack frames survive (debuggable), non-frames and the repeated message do not', () => {
  const frames = scrubStack(leaky().stack, leaky().message);
  assert.equal(frames.length, 3);
  assert.equal(frames[0], 'at saveClient (index.android.bundle:1:2345678)', 'line and column kept');
  assert.match(frames[1], /coach_clients\?<q>:2:10/);
  assert.deepEqual(scrubStack(undefined), []);
});

test('message scrubbing keeps the shape', () => {
  assert.equal(scrubMessage("undefined is not an object (evaluating 'x.y')"), "undefined is not an object (evaluating '…')");
  assert.equal(scrubMessage('Network request failed'), 'Network request failed');
  assert.equal(scrubMessage('x'.repeat(500)).length, 300);
});

test('routes: ids, numbers and queries become placeholders', () => {
  assert.equal(scrubRoute('/me/scale'), '/me/scale');
  assert.equal(scrubRoute(`/chat/${ID}#m`), '/chat/[id]');
  assert.equal(scrubRoute('/v/12345'), '/v/[id]');
  assert.equal(scrubRoute(undefined), '');
});

test('non-Error throws and odd names are handled', () => {
  assert.match(crashReport(`boom ${EMAIL}`, META).body, /^\[crash\] Error: boom <email>/);
  assert.match(crashReport({ any: 'thing' }, META).body, /Non-error thrown/);
  const e = new Error('x'); e.name = `${NAME}!`;
  assert.ok(!crashReport(e, META).body.includes('Jane'));
});

test('rate limit: each signature once a day, at most five a day', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  let log = admit('a', [], now)!;
  assert.equal(admit('a', log, now), null, 'same crash again today');
  for (const s of ['b', 'c', 'd', 'e']) log = admit(s, log, now)!;
  assert.equal(log.length, DAILY_LIMIT);
  assert.equal(admit('f', log, now), null);
  const tomorrow = new Date(now.getTime() + 86_400_001);
  assert.deepEqual(admit('a', log, tomorrow)?.map((x) => x.sig), ['a']);
  assert.equal(signature('E', ['at f (x:1:2)']), signature('E', ['at f (x:1:2)']));
  assert.notEqual(signature('E', ['at f (x:1:2)']), signature('E', ['at g (x:1:2)']));
});
