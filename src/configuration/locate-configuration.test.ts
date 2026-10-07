// spec: docs/specs/configuration.md, The configuration file

import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { test } from '../../test/helpers/test.ts';
import { locateConfiguration } from './locate-configuration.ts';

describe('locateConfiguration', () => {
  test('a given path that exists is returned', async () => {
    const file = fixturePath('ts-config/underdot.config.ts');
    expect(await locateConfiguration(file)).toBe(file);
  });

  test('a path that does not exist is named', async () => {
    const file = fixturePath('no-config/underdot.config.ts');
    await expect(locateConfiguration(file)).rejects.toThrow(new Error(`No configuration file at ${file}.`));
  });

  describe('in the ts-config fixture', () => {
    test.override({ fixture: 'ts-config' });

    test('a relative path is resolved against the working directory', async ({ workingDirectory }) => {
      expect(await locateConfiguration('underdot.config.ts')).toBe(join(workingDirectory, 'underdot.config.ts'));
    });

    test('with no path, the file is found in the working directory', async ({ workingDirectory }) => {
      expect(await locateConfiguration()).toBe(join(workingDirectory, 'underdot.config.ts'));
    });
  });

  describe('in the ts-and-js-config fixture', () => {
    test.override({ fixture: 'ts-and-js-config' });

    test('both files present is an error naming both', async ({ workingDirectory }) => {
      await expect(locateConfiguration()).rejects.toThrow(
        new Error(`Both ${join(workingDirectory, 'underdot.config.ts')} and ${join(workingDirectory, 'underdot.config.js')} are present. Keep one.`),
      );
    });
  });

  describe('in the no-config fixture', () => {
    test.override({ fixture: 'no-config' });

    test('neither file present is an error naming both names and the directory', async ({ workingDirectory }) => {
      await expect(locateConfiguration()).rejects.toThrow(
        new Error(`No underdot.config.ts or underdot.config.js in ${workingDirectory}.`),
      );
    });
  });
});
