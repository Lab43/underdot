// spec: docs/specs/plugins.md, Errors

import { describe, expect, test } from 'vitest';
import { attributePluginError } from './attribute-plugin-error.ts';

describe('attributePluginError', () => {
  test("the message is the unit, the plugin, then the error's message, and the error is the cause", () => {
    const cause = new Error('unexpected token');
    const error = attributePluginError('Rendering index.tpl', 'ejs', cause);
    expect(error.message).toBe('Rendering index.tpl failed in ejs: unexpected token');
    expect(error.cause).toBe(cause);
  });

  test('a thrown value that is not an Error is described as a string, and is the cause', () => {
    const error = attributePluginError('Running the page hook', 'listing', 'oops');
    expect(error.message).toBe('Running the page hook failed in listing: oops');
    expect(error.cause).toBe('oops');
  });
});
