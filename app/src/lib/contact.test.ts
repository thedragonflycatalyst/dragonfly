import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contactLink, intlDigits } from './contact';

test('intlDigits adds the US code to 10-digit numbers and keeps international ones', () => {
  assert.equal(intlDigits('(410) 555-0199'), '14105550199');
  assert.equal(intlDigits('+44 7700 900123'), '447700900123');
  assert.equal(intlDigits('555'), null);
});

test('contactLink builds WhatsApp and SMS links, nothing for in-app or missing numbers', () => {
  assert.equal(contactLink('whatsapp', '410-555-0199', 'Hi Ana & co'), 'https://wa.me/14105550199?text=Hi%20Ana%20%26%20co');
  assert.equal(contactLink('sms', '410-555-0199', 'Hi', 'android'), 'sms:4105550199?body=Hi');
  assert.equal(contactLink('sms', '+1 410 555 0199', 'Hi', 'ios'), 'sms:+14105550199&body=Hi');
  assert.equal(contactLink('app', '4105550199'), null);
  assert.equal(contactLink('sms', null), null);
});

test('e164 formats phone numbers for sign-up and sign-in', async () => {
  const { e164 } = await import('./contact');
  assert.equal(e164('(410) 555-0199'), '+14105550199');
  assert.equal(e164('+44 7700 900123'), '+447700900123');
  assert.equal(e164('hello'), null);
});
