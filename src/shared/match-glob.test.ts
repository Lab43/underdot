import { describe, expect, test } from 'vitest';
import { matchGlob } from './match-glob.ts';

describe('matchGlob', () => {
  test.each([
    ['styles/site.css', '**/*.css', true],
    ['site.css', '**/*.css', true],
    ['.well-known/x.css', '**/*.css', true],
    ['styles/_vars.scss', '**/*.scss', true],
    ['_partial.text', '**/*.{text,css}', true],
    ['styles/site.css.map', '**/*.css', false],
    ['drafts/plan.txt', 'drafts', false],
  ])('%s against %s is %s', (path, glob, matches) => {
    expect(matchGlob(path, glob)).toBe(matches);
  });
});
