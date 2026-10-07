import { describe, expect, test } from 'vitest';
import { isPlainPath } from './is-plain-path.ts';

describe('isPlainPath', () => {
  test.each(['notes.txt', 'images/photo-300.webp', '_private/notes.txt'])('%s is plain', (path) => {
    expect(isPlainPath(path)).toBe(true);
  });

  test.each([
    ['an empty path', ''],
    ['a leading slash', '/notes.txt'],
    ['a trailing slash', 'images/'],
    ['an empty segment', 'images//photo.jpg'],
    ['a . segment', './notes.txt'],
    ['a .. segment', 'images/../../notes.txt'],
    ['a number', 7],
    ['undefined', undefined],
  ])('%s is not plain', (_name, path) => {
    expect(isPlainPath(path)).toBe(false);
  });
});
