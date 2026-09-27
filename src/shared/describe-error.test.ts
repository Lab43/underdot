import { describe, expect, test } from 'vitest';
import { describeError } from './describe-error.ts';

describe('describeError', () => {
  test('an Error is described by its message', () => {
    expect(describeError(new Error('It broke.'))).toBe('It broke.');
  });

  test('anything else is described as a string', () => {
    expect(describeError(42)).toBe('42');
  });
});
