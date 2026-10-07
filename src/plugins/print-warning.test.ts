// spec: docs/specs/plugins.md, Errors

import { describe, expect } from 'vitest';
import { test } from '../../test/helpers/test.ts';
import { printWarning } from './print-warning.ts';

describe('printWarning', () => {
  test('the line on standard error is the unit, the plugin, then the message', ({ stderr }) => {
    printWarning('Handling styles/site.scss', 'sass', 'Deprecated.');
    expect(stderr).toStrictEqual(['Handling styles/site.scss warned in sass: Deprecated.\n']);
  });
});
