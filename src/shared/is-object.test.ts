import { describe, expect, test } from 'vitest';
import { isObject } from './is-object.ts';

describe('isObject', () => {
  test('an object literal is an object', () => {
    expect(isObject({})).toBe(true);
  });

  test.each([
    ['null', null],
    ['an array', []],
    ['a string', 'x'],
    ['undefined', undefined],
  ])('%s is not an object', (_name, value) => {
    expect(isObject(value)).toBe(false);
  });
});
