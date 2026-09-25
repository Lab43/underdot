// spec: docs/specs/build.md, Destination

import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { assertAbsent } from '../../test/helpers/assert-absent.ts';
import { copyFixture } from '../../test/helpers/copy-fixture.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { writeDestination } from './write-destination.ts';

const outputs = [
  { source: 'about/index.html', output: 'about/index.html' },
  { source: 'index.html', output: 'index.html' },
];
const planned = ['about/index.html', 'index.html'];

describe('writeDestination', () => {
  test('a destination that does not exist is created holding the outputs', async (t) => {
    const directory = await copyFixture(t, 'defaults');
    const destination = join(directory, 'build');
    await writeDestination(join(directory, 'source'), destination, outputs);
    assert.deepEqual(await walkSource(destination), planned);
    assert.equal(await readFile(join(destination, 'about/index.html'), 'utf8'), 'about/index.html\n');
  });

  test('everything that is not a planned output is removed', async (t) => {
    const directory = await copyFixture(t, 'defaults');
    const destination = join(directory, 'build');
    await mkdir(join(destination, 'old'), { recursive: true });
    await writeFile(join(destination, 'stale.txt'), 'a stale file');
    await writeFile(join(destination, 'old', 'page.html'), 'a file in a stale directory');
    await writeFile(join(destination, 'about'), 'a file where a directory is needed');
    await mkdir(join(destination, 'index.html'));
    await writeDestination(join(directory, 'source'), destination, outputs);
    assert.deepEqual(await walkSource(destination), planned);
    await assertAbsent(join(destination, 'stale.txt'));
    await assertAbsent(join(destination, 'old'));
  });

  test('a planned file already in place is overwritten by its copy', async (t) => {
    const directory = await copyFixture(t, 'defaults');
    const destination = join(directory, 'build');
    await mkdir(destination);
    await writeFile(join(destination, 'index.html'), 'the previous build');
    await writeDestination(join(directory, 'source'), destination, outputs);
    assert.equal(await readFile(join(destination, 'index.html'), 'utf8'), 'index.html\n');
  });

  test('no outputs leave the destination empty', async (t) => {
    const directory = await copyFixture(t, 'defaults');
    const destination = join(directory, 'build');
    await mkdir(destination);
    await writeFile(join(destination, 'stale.txt'), 'a stale file');
    await writeDestination(join(directory, 'source'), destination, []);
    assert.deepEqual(await walkSource(destination), []);
  });
});
