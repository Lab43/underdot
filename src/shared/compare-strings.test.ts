import { describe, expect, test } from 'vitest';
import { compareStrings } from './compare-strings.ts';

describe('compareStrings', () => {
  test('sorts by character code, capitals before lowercase', () => {
    expect(['b', 'a', 'B', 'a'].sort(compareStrings)).toStrictEqual(['B', 'a', 'a', 'b']);
  });

  test('equal strings compare as zero', () => {
    expect(compareStrings('a', 'a')).toBe(0);
  });
});
