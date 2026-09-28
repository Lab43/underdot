// spec: docs/specs/configuration.md, Programmatic use

import { dirname, join } from 'node:path';
import { describe, expect } from 'vitest';
import defaultsConfiguration from '../test/fixtures/defaults/underdot.config.ts';
import { fixturePath } from '../test/helpers/fixture-path.ts';
import { test } from '../test/helpers/test.ts';
import { build } from './index.ts';
import { walkSource } from './source-tree/walk-source.ts';

const defaultsFixture = fixturePath('defaults');

describe('build', () => {
  test('the configuration is resolved inside the build', async () => {
    await expect(build({ destination: '..' }, defaultsFixture)).rejects.toThrow(
      new Error(`The destination ${dirname(defaultsFixture)} must be inside the project directory ${defaultsFixture}.`),
    );
  });

  test('the project directory defaults to the working directory', async ({ workingDirectory }) => {
    await build(defaultsConfiguration);
    expect(await walkSource(join(workingDirectory, 'build'))).toStrictEqual([
      '.htaccess',
      '.well-known/security.txt',
      'about/index.html',
      'about/team.txt',
      'index.html',
      'styles/site.css',
    ]);
  });
});
