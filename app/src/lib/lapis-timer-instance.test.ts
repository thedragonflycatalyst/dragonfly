import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { timerInstanceKey } from '../features/lapis/timer-instance';
test('the same timer index in a different workout has distinct identity', () => {
  assert.notEqual(timerInstanceKey('user:w:one', '0:0:-'), timerInstanceKey('user:w:two', '0:0:-'));
});
test('identical workout block reuses identity', () => {
  assert.equal(timerInstanceKey('user:a:one', 'block'), timerInstanceKey('user:a:one', 'block'));
});
test('separator-containing keys remain collision safe', () => {
  assert.notEqual(timerInstanceKey('a:b', 'c'), timerInstanceKey('a', 'b:c'));
});
