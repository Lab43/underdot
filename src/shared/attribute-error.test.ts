import { describe, expect, test } from 'vitest';
import { attributeError } from './attribute-error.ts';

describe('attributeError', () => {
  test("the message is the path, then the error's message, and the error is the cause", () => {
    const cause = new Error('unexpected token');
    const error = attributeError('about.tpl', cause);
    expect(error.message).toBe('about.tpl: unexpected token');
    expect(error.cause).toBe(cause);
  });

  test('a thrown value that is not an Error is described as a string', () => {
    expect(attributeError('about.tpl', 'oops').message).toBe('about.tpl: oops');
  });
});
