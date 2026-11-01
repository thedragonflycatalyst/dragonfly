import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errText, isEmail } from './model.ts';

test('email check matches the database rule', () => {
  assert.ok(isEmail('jane@example.com'));
  assert.ok(isEmail('  jane.doe+pt@mail.co.uk '));
  for (const bad of ['', 'jane', 'jane@', 'jane@example', 'ja ne@example.com', '@example.com']) assert.equal(isEmail(bad), false, bad);
});

test('server errors become plain sentences', () => {
  assert.match(errText(new Error('duplicate key value violates unique constraint "coach_clients_trainer_email"')), /already have a client/);
  assert.match(errText({ message: 'rate_limited' }), /Wait a minute/);
  assert.match(errText({ message: 'new row violates row-level security policy' }), /access/);
  assert.equal(errText(new Error('Failed to fetch')), 'Can’t reach the server. Check your connection and try again.');
});
