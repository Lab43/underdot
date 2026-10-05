// spec: docs/specs/build.md, Destination

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { assertAbsent } from '../../test/helpers/assert-absent.ts';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { test } from '../../test/helpers/test.ts';
import type { Output } from '../plugins/handle-files.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import type { RenderedPage } from '../templates/render-pages.ts';
import { writeDestination } from './write-destination.ts';

const copy = (sourcePath: string): Output => ({ sourcePath, outputPath: sourcePath, contents: undefined });
const handled = (sourcePath: string, outputPath: string, text: string): Output => ({ sourcePath, outputPath, contents: Buffer.from(text) });
const page = (sourcePath: string, outputPath: string, contents = ''): RenderedPage => ({ sourcePath, outputPath, contents });

const copies = [copy('about/index.html'), copy('index.html')];
const planned = ['about/index.html', 'index.html'];

describe('writeDestination', () => {
  test('a destination that does not exist is created holding the copies', async ({ directory }) => {
    const destination = join(directory, 'build');
    await writeDestination(join(directory, 'source'), destination, copies, []);
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
    await writeDestination(join(directory, 'source'), destination, copies, []);
    expect(await walkSource(destination)).toStrictEqual(planned);
    await assertAbsent(join(destination, 'stale.txt'));
    await assertAbsent(join(destination, 'old'));
  });

  test('a planned file already in place is overwritten by its copy', async ({ directory }) => {
    const destination = join(directory, 'build');
    await mkdir(destination);
    await writeFile(join(destination, 'index.html'), 'the previous build');
    await writeDestination(join(directory, 'source'), destination, copies, []);
    expect(await readFile(join(destination, 'index.html'), 'utf8')).toBe('index.html\n');
  });

  test('an output with contents is written at its output path', async ({ directory }) => {
    const destination = join(directory, 'build');
    await writeDestination(join(directory, 'source'), destination, [handled('styles/site.scss', 'styles/site.css', 'body {}')], []);
    expect(await walkSource(destination)).toStrictEqual(['styles/site.css']);
    expect(await readFile(join(destination, 'styles/site.css'), 'utf8')).toBe('body {}');
  });

  test('a rendered page is written in a directory of its own, replacing a stale file at its path', async ({ directory }) => {
    const destination = join(directory, 'build');
    await mkdir(join(destination, 'about'), { recursive: true });
    await writeFile(join(destination, 'about/index.html'), 'the previous build');
    await writeDestination(join(directory, 'source'), destination, [copy('index.html')], [page('about.tpl', 'about/index.html', 'the rendered page')]);
    expect(await walkSource(destination)).toStrictEqual(planned);
    expect(await readFile(join(destination, 'about/index.html'), 'utf8')).toBe('the rendered page');
  });

  // spec: docs/specs/source-tree.md, Underscore prefix
  test('an output whose path has an underscore-prefixed segment is not written', async ({ directory }) => {
    const destination = join(directory, 'build');
    const outputs = [copy('index.html'), copy('_private.txt'), copy('_includes/header.html'), handled('notes.txt', 'about/_notes.txt', 'renamed into the prefix')];
    await writeDestination(join(directory, 'source'), destination, outputs, []);
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
        case: 'two outputs of one source',
        outputs: [copy('index.html'), copy('about/index.html'), copy('index.html')],
        pages: [],
        message: 'index.html would be written to index.html twice.',
      },
      {
        case: "a copy and a handler's renamed output",
        outputs: [copy('styles/site.css'), handled('styles/site.scss', 'styles/site.css', '')],
        pages: [],
        message: 'Both styles/site.css and styles/site.scss would be written to styles/site.css.',
      },
      {
        case: 'a page and a copy',
        outputs: [copy('about/index.html')],
        pages: [page('about.tpl', 'about/index.html')],
        message: 'Both about.tpl and about/index.html would be written to about/index.html.',
      },
      {
        case: 'a page beside a directory index with the same URL',
        outputs: [],
        pages: [page('about.tpl', 'about/index.html'), page('about/index.tpl', 'about/index.html')],
        message: 'Both about.tpl and about/index.tpl would be written to about/index.html.',
      },
      {
        case: 'two pages with one name and different extensions, named in sorted order',
        outputs: [],
        pages: [page('about.tpl', 'about/index.html'), page('about.md', 'about/index.html')],
        message: 'Both about.md and about.tpl would be written to about/index.html.',
      },
    ])('$case fail naming both', async ({ outputs, pages, message }) => {
      await expect(writeDestination(source, destination, outputs, pages)).rejects.toThrow(new Error(message));
      await assertAbsent(destination);
    });
  });
});
