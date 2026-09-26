import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isObject } from './is-object.ts';

describe('isObject', () => {
  test('an object literal is an object', () => {
    assert.equal(isObject({}), true);
  });

  for (const [name, value] of [['null', null], ['an array', []], ['a string', 'x'], ['undefined', undefined]] as const) {
    test(`${name} is not an object`, () => {
      assert.equal(isObject(value), false);
    });
  }
});
