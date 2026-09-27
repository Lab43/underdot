// spec: docs/specs/build.md

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import defaultsConfiguration from '../../test/fixtures/defaults/underdot.config.ts';
import excludingConfiguration from '../../test/fixtures/excluding/underdot.config.ts';
import templatedConfiguration from '../../test/fixtures/templated/underdot.config.ts';
import { assertAbsent } from '../../test/helpers/assert-absent.ts';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { test } from '../../test/helpers/test.ts';
import { resolveConfiguration } from '../configuration/resolve-configuration.ts';
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
  test('the defaults fixture builds its static files, each byte-equal to its source', async ({ directory }) => {
    const destination = join(directory, 'build');
    await build(resolveConfiguration(defaultsConfiguration, directory));
    expect(await list(destination)).toStrictEqual(defaultsFiles);
    expect(await contents(destination, defaultsFiles)).toStrictEqual(await contents(join(directory, 'source'), defaultsFiles));
    await assertAbsent(join(destination, 'litter'));
  });

  test('building twice produces the same destination', async ({ directory }) => {
    const destination = join(directory, 'build');
    const configuration = resolveConfiguration(defaultsConfiguration, directory);
    await build(configuration);
    const first = await contents(destination, defaultsFiles);
    await build(configuration);
    expect(await list(destination)).toStrictEqual(defaultsFiles);
    expect(await contents(destination, defaultsFiles)).toStrictEqual(first);
  });

  describe('the excluding fixture', () => {
    test.override({ fixture: 'excluding' });

    test('builds only what its patterns keep', async ({ directory }) => {
      await build(resolveConfiguration(excludingConfiguration, directory));
      expect(await list(join(directory, 'build'))).toStrictEqual(['.DS_Store', 'index.html']);
    });
  });

  describe('the templated fixture', () => {
    test.override({ fixture: 'templated' });

    test('builds its static files alone: no page is copied and no template is written', async ({ directory }) => {
      await build(resolveConfiguration(templatedConfiguration, directory));
      expect(await list(join(directory, 'build'))).toStrictEqual(['notes.txt', 'styles/site.css']);
    });
  });

  test('a frontmatter error names the page and fails before any write', async () => {
    const directory = fixturePath('bad-frontmatter');
    const plugins = [{ name: 'fixture', renderers: { tpl: (body: string) => body } }];
    await expect(build(resolveConfiguration({ plugins }, directory))).rejects.toThrow(
      new Error('index.tpl: The frontmatter key _title starts with an underscore, which is reserved.'),
    );
    await assertAbsent(join(directory, 'build'));
  });

  test('two plugins with one name fail before any write', async () => {
    const configuration = resolveConfiguration({ plugins: [{ name: 'dup' }, { name: 'dup' }] }, defaultsFixture);
    await expect(build(configuration)).rejects.toThrow(new Error('Two plugins are named dup.'));
    await assertAbsent(join(defaultsFixture, 'build'));
  });

  test("the walk's error reaches the caller", async () => {
    await expect(build(resolveConfiguration({ source: 'content' }, defaultsFixture))).rejects.toThrow(
      new Error(`The source root ${join(defaultsFixture, 'content')} does not exist.`),
    );
  });
});
