import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { test } from '../../test/helpers/test.ts';
import { importDefault } from './import-default.ts';

describe('importDefault', () => {
  test("a module's default export is its value", async ({ directory }) => {
    const file = join(directory, 'value.js');
    await writeFile(file, 'export default 42;\n');
    await expect(importDefault(file)).resolves.toBe(42);
  });

  test('a module without a default export yields undefined', async ({ directory }) => {
    const file = join(directory, 'named.js');
    await writeFile(file, 'export const value = 42;\n');
    await expect(importDefault(file)).resolves.toBeUndefined();
  });
});
