import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errText, parseInviteCode } from './model.ts';

test('invite code from a bare code, any case, with spaces or dashes', () => {
  assert.equal(parseInviteCode('ab12cd34'), 'AB12CD34');
  assert.equal(parseInviteCode('  AB12-CD34 '), 'AB12CD34');
});

test('invite code from a pasted link', () => {
  assert.equal(parseInviteCode('https://thedragonflycatalyst.github.io/dragonfly-coach/join?code=Ab12Cd34'), 'AB12CD34');
  assert.equal(parseInviteCode('Join me: https://x.io/join?ref=1&code=FE99BC88 see you'), 'FE99BC88');
});

test('rejects things that are not codes', () => {
  assert.equal(parseInviteCode(''), null);
  assert.equal(parseInviteCode('hello there'), null);
  assert.equal(parseInviteCode('abc'), null);
  assert.equal(parseInviteCode('GHIJKLMN'), null);
  assert.equal(parseInviteCode('AB12CD345'), null);
});

test('server errors become plain sentences', () => {
  assert.match(errText(new Error('That invite code is invalid or has expired.')), /Ask your trainer/);
  assert.match(errText({ message: 'new row violates row-level security policy' }), /access/);
  assert.equal(errText(new Error('Failed to fetch')), 'Can’t reach the server. Check your connection and try again.');
});
