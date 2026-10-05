// spec: docs/specs/helpers.md

import { tz } from '@date-fns/tz';
import { format } from 'date-fns';
import type { RenderContext } from 'underdot';

// Every date formats in UTC, so the output is the same on every machine.
const utc = tz('UTC');

/**
 * A date printed with date-fns's format tokens, in UTC.
 */
export const formatDate = (_context: RenderContext, date: unknown, dateFormat: unknown, ...rest: unknown[]): string => {
  if (!(date instanceof Date) && typeof date !== 'string' && typeof date !== 'number') {
    throw new Error(`The date must be a Date, a string, or a number, and ${String(date)} is not.`);
  }
  if (typeof dateFormat !== 'string') {
    throw new Error(`The format must be a string, and ${String(dateFormat)} is not.`);
  }
  if (rest.length > 0) {
    throw new Error('formatDate takes a date and a format and nothing else.');
  }
  return format(date, dateFormat, { in: utc });
};
