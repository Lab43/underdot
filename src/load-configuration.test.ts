// spec: docs/specs/configuration.md

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfiguration } from './load-configuration.ts';

const fixtures = fileURLToPath(new URL('../test/fixtures/configuration/', import.meta.url));
const fixture = (name: string): string => join(fixtures, name);

describe('loadConfiguration', () => {
  test('a TypeScript file loads with its values resolved under its own directory', async () => {
    const directory = fixture('ts-config');
    assert.deepEqual(await loadConfiguration(join(directory, 'underdot.config.ts')), {
      projectDirectory: directory,
      source: join(directory, 'content'),
      destination: join(directory, 'public'),
      exclude: ['**/*.draft'],
    });
  });

  test('a JavaScript file loads', async () => {
    const directory = fixture('js-config');
    const resolved = await loadConfiguration(join(directory, 'underdot.config.js'));
    assert.equal(resolved.source, join(directory, 'content'));
  });

  test('a path that does not exist is named', async () => {
    const file = fixture('no-config/underdot.config.ts');
    await assert.rejects(loadConfiguration(file), { message: `No configuration file at ${file}.` });
  });

  test('a module without a default export is not a configuration', async () => {
    await assert.rejects(loadConfiguration(fixture('no-default-export/underdot.config.ts')), {
      message: 'The configuration must be an object.',
    });
  });

  describe('with no path', () => {
    const inFixture = (t: TestContext, name: string): string => {
      const original = process.cwd();
      process.chdir(fixture(name));
      t.after(() => {
        process.chdir(original);
      });
      return process.cwd();
    };

    test('the file is found in the working directory', async (t) => {
      const directory = inFixture(t, 'ts-config');
      const resolved = await loadConfiguration();
      assert.equal(resolved.projectDirectory, directory);
      assert.equal(resolved.source, join(directory, 'content'));
    });

    test('both files present is an error naming both', async (t) => {
      const directory = inFixture(t, 'ts-and-js-config');
      await assert.rejects(loadConfiguration(), {
        message: `Both ${join(directory, 'underdot.config.ts')} and ${join(directory, 'underdot.config.js')} are present. Keep one.`,
      });
    });

    test('neither file present is an error naming both names and the directory', async (t) => {
      const directory = inFixture(t, 'no-config');
      await assert.rejects(loadConfiguration(), {
        message: `No underdot.config.ts or underdot.config.js in ${directory}.`,
      });
    });
  });
});
