// spec: docs/specs/helpers.md

import type { RenderContext } from 'underdot';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { formatDate } from './format-date.ts';

const context: RenderContext = {
  sourcePath: 'blog/_post.ejs',
  variables: {},
  readFile: () => undefined,
  readOutput: () => undefined,
  readBody: () => '',
  enterFile: () => context,
  emit: () => {
    throw new Error('This test never emits.');
  },
};

const midnight = new Date('2024-01-02T00:00:00.000Z');
const evening = new Date('2024-01-02T18:00:00.000Z');

describe('formatDate', () => {
  // West of Greenwich, a local-time read of a UTC midnight is the day before.
  // CI runs in UTC, where a local-time bug prints nothing wrong.
  beforeEach(() => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('the zone stub took effect', () => {
    expect(midnight.getDate()).toBe(1);
  });

  test.each([
    ['the Date', midnight],
    ['the string', '2024-01-02'],
    ['the milliseconds', midnight.getTime()],
  ])('%s at UTC midnight prints the date as written', (_kind, date) => {
    expect(formatDate(context, date, 'MMMM d, yyyy')).toBe('January 2, 2024');
  });

  test('a time prints in UTC', () => {
    expect(formatDate(context, evening, "MMMM d, yyyy 'at' h:mm a")).toBe('January 2, 2024 at 6:00 PM');
  });

  test.each<unknown>([null, true, undefined, {}])('a date of %j fails', (date) => {
    expect(() => formatDate(context, date, 'yyyy')).toThrow(new Error(`The date must be a Date, a string, or a number, and ${String(date)} is not.`));
  });

  test('a format that is not a string fails', () => {
    expect(() => formatDate(context, midnight, 42)).toThrow(new Error('The format must be a string, and 42 is not.'));
  });

  test('a third argument fails', () => {
    expect(() => formatDate(context, midnight, 'yyyy', {})).toThrow(new Error('formatDate takes a date and a format and nothing else.'));
  });

  test("date-fns's own error for a wrong token passes through", () => {
    expect(() => formatDate(context, midnight, 'YYYY')).toThrow(RangeError);
    expect(() => formatDate(context, midnight, 'YYYY')).toThrow(/^Use `yyyy` instead of `YYYY`/);
  });

  test("date-fns's own error for a string it cannot parse passes through", () => {
    expect(() => formatDate(context, 'nope', 'yyyy')).toThrow(new RangeError('Invalid time value'));
  });
});
