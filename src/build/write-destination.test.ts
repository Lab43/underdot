// spec: docs/specs/build.md, Destination

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { assertAbsent } from '../../test/helpers/assert-absent.ts';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { test } from '../../test/helpers/test.ts';
import type { StaticFile } from '../source-tree/classify-source.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import type { RenderedPage } from '../templates/render-pages.ts';
import { writeDestination } from './write-destination.ts';

const staticFile = (sourcePath: string, isPrivate = false): StaticFile => ({ sourcePath, private: isPrivate });
const page = (sourcePath: string, outputPath: string, contents = ''): RenderedPage => ({ sourcePath, outputPath, contents });

const staticFiles = [staticFile('about/index.html'), staticFile('index.html')];
const planned = ['about/index.html', 'index.html'];

describe('writeDestination', () => {
  test('a destination that does not exist is created holding the static files', async ({ directory }) => {
    const destination = join(directory, 'build');
    await writeDestination(join(directory, 'source'), destination, staticFiles, []);
    expect(await walkSource(destination)).toStrictEqual(planned);
    expect(await readFile(join(destination, 'about/index.html'), 'utf8')).toBe('about/index.html\n');
  });

  test('everything that is not a planned output is removed', async ({ directory }) => {
    const destination = join(directory, 'build');
    await mkdir(join(destination, 'old'), { recursive: true });
    await writeFile(join(destination, 'stale.txt'), 'a stale file');
    await writeFile(join(destination, 'old', 'page.html'), 'a file in a stale directory');
    await writeFile(join(destination, 'about'), 'a file where a directory is needed');
    await mkdir(join(destination, 'index.html'));
    await writeDestination(join(directory, 'source'), destination, staticFiles, []);
    expect(await walkSource(destination)).toStrictEqual(planned);
    await assertAbsent(join(destination, 'stale.txt'));
    await assertAbsent(join(destination, 'old'));
  });

  test('a planned file already in place is overwritten by its copy', async ({ directory }) => {
    const destination = join(directory, 'build');
    await mkdir(destination);
    await writeFile(join(destination, 'index.html'), 'the previous build');
    await writeDestination(join(directory, 'source'), destination, staticFiles, []);
    expect(await readFile(join(destination, 'index.html'), 'utf8')).toBe('index.html\n');
  });

  test('a rendered page is written in a directory of its own, replacing a stale file at its path', async ({ directory }) => {
    const destination = join(directory, 'build');
    await mkdir(join(destination, 'about'), { recursive: true });
    await writeFile(join(destination, 'about/index.html'), 'the previous build');
    await writeDestination(join(directory, 'source'), destination, [staticFile('index.html')], [page('about.tpl', 'about/index.html', 'the rendered page')]);
    expect(await walkSource(destination)).toStrictEqual(planned);
    expect(await readFile(join(destination, 'about/index.html'), 'utf8')).toBe('the rendered page');
  });

  // spec: docs/specs/source-tree.md, Underscore prefix
  test('a private static file is not written', async ({ directory }) => {
    const destination = join(directory, 'build');
    await writeDestination(join(directory, 'source'), destination, [staticFile('index.html'), staticFile('_private.txt', true)], []);
    expect(await walkSource(destination)).toStrictEqual(['index.html']);
  });

  test('no outputs leave the destination empty', async ({ directory }) => {
    const destination = join(directory, 'build');
    await mkdir(destination);
    await writeFile(join(destination, 'stale.txt'), 'a stale file');
    await writeDestination(join(directory, 'source'), destination, [], []);
    expect(await walkSource(destination)).toStrictEqual([]);
  });

  // spec: docs/specs/source-tree.md, Output paths are unique
  describe('two sources with one output path', () => {
    const source = fixturePath('defaults', 'source');
    const destination = fixturePath('defaults', 'build');

    test.each([
      {
        case: 'two static files',
        staticFiles: [staticFile('index.html'), staticFile('about/index.html'), staticFile('index.html')],
        pages: [],
        message: 'Both index.html and index.html would be written to index.html.',
      },
      {
        case: 'a page and a static file',
        staticFiles: [staticFile('about/index.html')],
        pages: [page('about.tpl', 'about/index.html')],
        message: 'Both about.tpl and about/index.html would be written to about/index.html.',
      },
      {
        case: 'a page beside a directory index with the same URL',
        staticFiles: [],
        pages: [page('about.tpl', 'about/index.html'), page('about/index.tpl', 'about/index.html')],
        message: 'Both about.tpl and about/index.tpl would be written to about/index.html.',
      },
      {
        case: 'two pages with one name and different extensions, named in sorted order',
        staticFiles: [],
        pages: [page('about.tpl', 'about/index.html'), page('about.md', 'about/index.html')],
        message: 'Both about.md and about.tpl would be written to about/index.html.',
      },
    ])('$case fail naming both', async ({ staticFiles: files, pages, message }) => {
      await expect(writeDestination(source, destination, files, pages)).rejects.toThrow(new Error(message));
      await assertAbsent(destination);
    });
  });
});
