// spec: docs/specs/build.md

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import bustConfiguration from '../../test/fixtures/bust/underdot.config.ts';
import defaultsConfiguration from '../../test/fixtures/defaults/underdot.config.ts';
import ejsConfiguration from '../../test/fixtures/ejs/underdot.config.ts';
import excludingConfiguration from '../../test/fixtures/excluding/underdot.config.ts';
import helpersConfiguration from '../../test/fixtures/helpers/underdot.config.ts';
import svgoConfiguration from '../../test/fixtures/svgo/underdot.config.ts';
import templatedConfiguration from '../../test/fixtures/templated/underdot.config.ts';
import { assertAbsent } from '../../test/helpers/assert-absent.ts';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { renderBody } from '../../test/helpers/render-body.ts';
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

    // spec: docs/specs/plugins.md, Render context
    test('builds every page through its chain beside its static files, file for file as expected', async ({ directory }) => {
      const destination = join(directory, 'build');
      const expected = fixturePath('templated', 'expected');
      await build(resolveConfiguration(templatedConfiguration, directory));
      const paths = await list(destination);
      expect(paths).toStrictEqual(await list(expected));
      for (const path of paths) {
        await expect(await readFile(join(destination, path), 'utf8')).toMatchFileSnapshot(join(expected, path));
      }
    });
  });

  describe('the ejs fixture', () => {
    test.override({ fixture: 'ejs' });

    // spec: docs/specs/ejs.md
    test('builds every page through EJS, its includes and data among them, file for file as expected', async ({ directory }) => {
      const destination = join(directory, 'build');
      const expected = fixturePath('ejs', 'expected');
      await build(resolveConfiguration(ejsConfiguration, directory));
      const paths = await list(destination);
      expect(paths).toStrictEqual(await list(expected));
      for (const path of paths) {
        await expect(await readFile(join(destination, path), 'utf8')).toMatchFileSnapshot(join(expected, path));
      }
    });
  });

  describe('the bust fixture', () => {
    test.override({ fixture: 'bust' });

    // spec: docs/specs/bust.md
    test('busts each link with the hash of the handled output, file for file as expected', async ({ directory }) => {
      const destination = join(directory, 'build');
      const expected = fixturePath('bust', 'expected');
      await build(resolveConfiguration(bustConfiguration, directory));
      const paths = await list(destination);
      expect(paths).toStrictEqual(await list(expected));
      for (const path of paths) {
        await expect(await readFile(join(destination, path), 'utf8')).toMatchFileSnapshot(join(expected, path));
      }
    });
  });

  describe('the helpers fixture', () => {
    test.override({ fixture: 'helpers' });

    // spec: docs/specs/helpers.md
    test('marks each link, formats the date, and guards each include on the served output, file for file as expected', async ({ directory }) => {
      const destination = join(directory, 'build');
      const expected = fixturePath('helpers', 'expected');
      await build(resolveConfiguration(helpersConfiguration, directory));
      const paths = await list(destination);
      expect(paths).toStrictEqual(await list(expected));
      for (const path of paths) {
        await expect(await readFile(join(destination, path), 'utf8')).toMatchFileSnapshot(join(expected, path));
      }
    });
  });

  describe('the svgo fixture', () => {
    test.override({ fixture: 'svgo' });

    // spec: docs/specs/svgo.md
    test('optimizes every SVG and inlines a private one, file for file as expected', async ({ directory }) => {
      const destination = join(directory, 'build');
      const expected = fixturePath('svgo', 'expected');
      await build(resolveConfiguration(svgoConfiguration, directory));
      const paths = await list(destination);
      expect(paths).toStrictEqual(await list(expected));
      for (const path of paths) {
        await expect(await readFile(join(destination, path), 'utf8')).toMatchFileSnapshot(join(expected, path));
      }
    });
  });

  test('a frontmatter error names the page and fails before any write', async () => {
    const directory = fixturePath('bad-frontmatter');
    const plugins = [{ name: 'fixture', renderers: { tpl: renderBody } }];
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
