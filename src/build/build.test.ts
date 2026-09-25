// spec: docs/specs/build.md

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import defaultsConfiguration from '../../test/fixtures/defaults/underdot.config.ts';
import excludingConfiguration from '../../test/fixtures/excluding/underdot.config.ts';
import { assertAbsent } from '../../test/helpers/assert-absent.ts';
import { changeDirectory } from '../../test/helpers/change-directory.ts';
import { copyFixture } from '../../test/helpers/copy-fixture.ts';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { build } from './build.ts';

const defaultsFixture = fixturePath('defaults');

const defaultsFiles = [
  '.htaccess',
  '.well-known/security.txt',
  'about/index.html',
  'about/team.txt',
  'index.html',
  'styles/site.css',
];

// The walk lists a destination the same way it lists a source.
const list = walkSource;

const contents = async (directory: string, paths: string[]): Promise<string[]> =>
  Promise.all(paths.map((path) => readFile(join(directory, path), 'utf8')));

describe('build', () => {
  test('the defaults fixture builds its static files, each byte-equal to its source', async (t) => {
    const directory = await copyFixture(t, 'defaults');
    const destination = join(directory, 'build');
    await build(defaultsConfiguration, directory);
    assert.deepEqual(await list(destination), defaultsFiles);
    assert.deepEqual(await contents(destination, defaultsFiles), await contents(join(directory, 'source'), defaultsFiles));
    await assertAbsent(join(destination, 'litter'));
  });

  test('building twice produces the same destination', async (t) => {
    const directory = await copyFixture(t, 'defaults');
    const destination = join(directory, 'build');
    await build(defaultsConfiguration, directory);
    const first = await contents(destination, defaultsFiles);
    await build(defaultsConfiguration, directory);
    assert.deepEqual(await list(destination), defaultsFiles);
    assert.deepEqual(await contents(destination, defaultsFiles), first);
  });

  test('the excluding fixture builds only what its patterns keep', async (t) => {
    const directory = await copyFixture(t, 'excluding');
    await build(excludingConfiguration, directory);
    assert.deepEqual(await list(join(directory, 'build')), ['.DS_Store', 'index.html']);
  });

  test("the walk's error reaches the caller", async () => {
    await assert.rejects(build({ source: 'content' }, defaultsFixture), {
      message: `The source root ${join(defaultsFixture, 'content')} does not exist.`,
    });
  });

  test('the configuration is resolved inside the build', async () => {
    await assert.rejects(build({ destination: '..' }, defaultsFixture), {
      message: `The destination ${dirname(defaultsFixture)} must be inside the project directory ${defaultsFixture}.`,
    });
  });

  test('the project directory defaults to the working directory', async (t) => {
    const directory = await copyFixture(t, 'defaults');
    changeDirectory(t, directory);
    await build(defaultsConfiguration);
    assert.deepEqual(await list(join(directory, 'build')), defaultsFiles);
  });
});
