import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { describeError } from './describe-error.ts';

describe('describeError', () => {
  test('an Error is described by its message', () => {
    assert.equal(describeError(new Error('It broke.')), 'It broke.');
  });

  test('anything else is described as a string', () => {
    assert.equal(describeError(42), '42');
  });
});
