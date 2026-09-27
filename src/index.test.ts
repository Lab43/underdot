// spec: docs/specs/configuration.md, Programmatic use

import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';
import defaultsConfiguration from '../test/fixtures/defaults/underdot.config.ts';
import { changeDirectory } from '../test/helpers/change-directory.ts';
import { copyFixture } from '../test/helpers/copy-fixture.ts';
import { fixturePath } from '../test/helpers/fixture-path.ts';
import { build } from './index.ts';
import { walkSource } from './source-tree/walk-source.ts';

const defaultsFixture = fixturePath('defaults');

describe('build', () => {
  test('the configuration is resolved inside the build', async () => {
    await expect(build({ destination: '..' }, defaultsFixture)).rejects.toThrow(
      new Error(`The destination ${dirname(defaultsFixture)} must be inside the project directory ${defaultsFixture}.`),
    );
  });

  test('the project directory defaults to the working directory', async () => {
    const directory = await copyFixture('defaults');
    changeDirectory(directory);
    await build(defaultsConfiguration);
    expect(await walkSource(join(directory, 'build'))).toStrictEqual([
      '.htaccess',
      '.well-known/security.txt',
      'about/index.html',
      'about/team.txt',
      'index.html',
      'styles/site.css',
    ]);
  });
});
