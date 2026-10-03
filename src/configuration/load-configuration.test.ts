// spec: docs/specs/configuration.md

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
    describe('in the ts-config fixture', () => {
      test.override({ fixture: 'ts-config' });

      test('the file is found in the working directory', async ({ workingDirectory }) => {
        const resolved = await loadConfiguration();
        expect(resolved.projectDirectory).toBe(workingDirectory);
        expect(resolved.source).toBe(join(workingDirectory, 'content'));
      });
    });

    describe('in the ts-and-js-config fixture', () => {
      test.override({ fixture: 'ts-and-js-config' });

      test('both files present is an error naming both', async ({ workingDirectory }) => {
        await expect(loadConfiguration()).rejects.toThrow(
          new Error(`Both ${join(workingDirectory, 'underdot.config.ts')} and ${join(workingDirectory, 'underdot.config.js')} are present. Keep one.`),
        );
      });
    });

    describe('in the no-config fixture', () => {
      test.override({ fixture: 'no-config' });

      test('neither file present is an error naming both names and the directory', async ({ workingDirectory }) => {
        await expect(loadConfiguration()).rejects.toThrow(
          new Error(`No underdot.config.ts or underdot.config.js in ${workingDirectory}.`),
        );
      });
    });
  });
});
