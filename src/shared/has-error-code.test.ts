import { describe, expect, test } from 'vitest';
import { hasErrorCode } from './has-error-code.ts';

describe('hasErrorCode', () => {
  test('an error with the code matches', () => {
    expect(hasErrorCode(Object.assign(new Error('missing'), { code: 'ENOENT' }), 'ENOENT')).toBe(true);
  });

  test('an error with another code, one with no code, and a value that is not an error do not', () => {
    expect(hasErrorCode(Object.assign(new Error('busy'), { code: 'EADDRINUSE' }), 'ENOENT')).toBe(false);
    expect(hasErrorCode(new Error('plain'), 'ENOENT')).toBe(false);
    expect(hasErrorCode({ code: 'ENOENT' }, 'ENOENT')).toBe(false);
  });
});
