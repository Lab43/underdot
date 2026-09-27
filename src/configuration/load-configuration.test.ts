// spec: docs/specs/configuration.md

import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { changeDirectory } from '../../test/helpers/change-directory.ts';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
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
    });
  });

  test('a JavaScript file loads', async () => {
    const directory = fixturePath('js-config');
    const resolved = await loadConfiguration(join(directory, 'underdot.config.js'));
    expect(resolved.source).toBe(join(directory, 'content'));
  });

  test('a path that does not exist is named', async () => {
    const file = fixturePath('no-config/underdot.config.ts');
    await expect(loadConfiguration(file)).rejects.toThrow(new Error(`No configuration file at ${file}.`));
  });

  test('a module without a default export is not a configuration', async () => {
    await expect(loadConfiguration(fixturePath('no-default-export/underdot.config.ts'))).rejects.toThrow(
      new Error('The configuration must be an object.'),
    );
  });

  describe('with no path', () => {
    const inFixture = (name: string): string => {
      changeDirectory(fixturePath(name));
      return process.cwd();
    };

    test('the file is found in the working directory', async () => {
      const directory = inFixture('ts-config');
      const resolved = await loadConfiguration();
      expect(resolved.projectDirectory).toBe(directory);
      expect(resolved.source).toBe(join(directory, 'content'));
    });

    test('both files present is an error naming both', async () => {
      const directory = inFixture('ts-and-js-config');
      await expect(loadConfiguration()).rejects.toThrow(
        new Error(`Both ${join(directory, 'underdot.config.ts')} and ${join(directory, 'underdot.config.js')} are present. Keep one.`),
      );
    });

    test('neither file present is an error naming both names and the directory', async () => {
      const directory = inFixture('no-config');
      await expect(loadConfiguration()).rejects.toThrow(
        new Error(`No underdot.config.ts or underdot.config.js in ${directory}.`),
      );
    });
  });
});
