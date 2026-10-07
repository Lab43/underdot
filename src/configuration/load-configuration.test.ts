// spec: docs/specs/configuration.md

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { test } from '../../test/helpers/test.ts';
import { loadConfiguration } from './load-configuration.ts';

describe('loadConfiguration', () => {
  test('a TypeScript file loads with its values resolved under its own directory', async () => {
    const directory = fixturePath('ts-config');
    expect(await loadConfiguration(join(directory, 'underdot.config.ts'))).toStrictEqual({
      projectDirectory: directory,
      source: join(directory, 'content'),
      destination: join(directory, 'public'),
      exclude: ['**/*.draft'],
      plugins: [],
      globals: {},
      rewrites: {},
    });
  });

  test('a JavaScript file loads', async () => {
    const directory = fixturePath('js-config');
    const resolved = await loadConfiguration(join(directory, 'underdot.config.js'));
    expect(resolved.source).toBe(join(directory, 'content'));
  });

  test('a module without a default export is not a configuration', async () => {
    await expect(loadConfiguration(fixturePath('no-default-export/underdot.config.ts'))).rejects.toThrow(
      new Error('The configuration must be an object.'),
    );
  });

  test('a rewritten file loads as it stands under a new version', async ({ directory }) => {
    const file = join(directory, 'underdot.config.ts');
    expect((await loadConfiguration(file, '1')).source).toBe(join(directory, 'source'));
    await writeFile(file, "export default { source: 'content' };\n");
    expect((await loadConfiguration(file, '2')).source).toBe(join(directory, 'content'));
  });
});
