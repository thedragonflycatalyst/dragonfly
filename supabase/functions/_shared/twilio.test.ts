import assert from 'node:assert/strict';
import { safeEqual, twilioSignature } from './twilio.ts';

Deno.test('signature depends on token, URL and every parameter (order-independent)', async () => {
  const url = 'https://example.supabase.co/functions/v1/coach-sms-inbound';
  const a = await twilioSignature('secret', url, { From: '+14105550123', Body: 'C' });
  const b = await twilioSignature('secret', url, { Body: 'C', From: '+14105550123' });
  assert.equal(a, b);
  assert.notEqual(a, await twilioSignature('other', url, { From: '+14105550123', Body: 'C' }));
  assert.notEqual(a, await twilioSignature('secret', url, { From: '+14105550123', Body: 'R' }));
  assert.match(a, /^[A-Za-z0-9+/]{27}=$/);
  assert.ok(safeEqual(a, b));
  assert.ok(!safeEqual(a, a.slice(0, -1) + 'x'));
});
