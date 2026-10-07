// spec: docs/specs/build.md, Destination

import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';
import { assertAbsent } from '../../test/helpers/assert-absent.ts';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { listWriteTargets } from '../../test/helpers/list-write-targets.ts';
import { test } from '../../test/helpers/test.ts';
import type { Output } from '../plugins/handle-files.ts';
import type { EmittedOutput } from '../plugins/produce-files.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import type { RenderedPage } from '../templates/render-pages.ts';
import { writeDestination } from './write-destination.ts';

vi.mock('node:fs/promises', { spy: true });

const copy = (sourcePath: string, hash = sourcePath): Output => ({ sourcePath, outputPath: sourcePath, contents: undefined, hash });
const handled = (sourcePath: string, outputPath: string, text: string): Output => ({ sourcePath, outputPath, contents: Buffer.from(text), hash: text });
const page = (sourcePath: string, outputPath: string, contents = ''): RenderedPage => ({ sourcePath, outputPath, contents, hash: contents, emits: [] });
const produced = (sourcePath: string, outputPath: string, text: string): EmittedOutput => ({ sourcePath, outputPath, contents: Buffer.from(text), hash: text });

const copies = [copy('about/index.html'), copy('index.html')];
const planned = ['about/index.html', 'index.html'];

// The destination paths written by the last call, in order.
const writes = (): string[] => {
  const written = listWriteTargets();
  vi.mocked(writeFile).mockClear();
  vi.mocked(copyFile).mockClear();
  return written.sort();
};

describe('writeDestination', () => {
  test('a destination that does not exist is created holding the copies', async ({ directory }) => {
    const destination = join(directory, 'build');
    await writeDestination(join(directory, 'source'), destination, copies, [], [], new Map());
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
    await writeDestination(join(directory, 'source'), destination, copies, [], [], new Map());
    expect(await walkSource(destination)).toStrictEqual(planned);
    await assertAbsent(join(destination, 'stale.txt'));
    await assertAbsent(join(destination, 'old'));
  });

  test('a planned file already in place is overwritten by its copy', async ({ directory }) => {
    const destination = join(directory, 'build');
    await mkdir(destination);
    await writeFile(join(destination, 'index.html'), 'the previous build');
    await writeDestination(join(directory, 'source'), destination, copies, [], [], new Map());
    expect(await readFile(join(destination, 'index.html'), 'utf8')).toBe('index.html\n');
  });

  test('an output with contents is written at its output path', async ({ directory }) => {
    const destination = join(directory, 'build');
    await writeDestination(join(directory, 'source'), destination, [handled('styles/site.scss', 'styles/site.css', 'body {}')], [], [], new Map());
    expect(await walkSource(destination)).toStrictEqual(['styles/site.css']);
    expect(await readFile(join(destination, 'styles/site.css'), 'utf8')).toBe('body {}');
  });

  test('a rendered page is written in a directory of its own, replacing a stale file at its path', async ({ directory }) => {
    const destination = join(directory, 'build');
    await mkdir(join(destination, 'about'), { recursive: true });
    await writeFile(join(destination, 'about/index.html'), 'the previous build');
    await writeDestination(join(directory, 'source'), destination, [copy('index.html')], [], [page('about.tpl', 'about/index.html', 'the rendered page')], new Map());
    expect(await walkSource(destination)).toStrictEqual(planned);
    expect(await readFile(join(destination, 'about/index.html'), 'utf8')).toBe('the rendered page');
  });

  // spec: docs/specs/source-tree.md, Underscore prefix
  test('an output whose path has an underscore-prefixed segment is not written', async ({ directory }) => {
    const destination = join(directory, 'build');
    const outputs = [copy('index.html'), copy('_private.txt'), copy('_includes/header.html'), handled('notes.txt', 'about/_notes.txt', 'renamed into the prefix')];
    await writeDestination(join(directory, 'source'), destination, outputs, [], [], new Map());
    expect(await walkSource(destination)).toStrictEqual(['index.html']);
  });

  test('no outputs leave the destination empty', async ({ directory }) => {
    const destination = join(directory, 'build');
    await mkdir(destination);
    await writeFile(join(destination, 'stale.txt'), 'a stale file');
    await writeDestination(join(directory, 'source'), destination, [], [], [], new Map());
    expect(await walkSource(destination)).toStrictEqual([]);
  });

  // spec: docs/specs/build.md, Incremental builds
  describe('across two calls with one table', () => {
    test('a second write of the same plan writes nothing, and the table holds every file written', async ({ directory }) => {
      const destination = join(directory, 'build');
      const written = new Map<string, string>();
      const outputs = [copy('index.html'), handled('styles/site.scss', 'styles/site.css', 'body {}')];
      const pages = [page('about.tpl', 'about/index.html', 'the rendered page')];
      writes();
      await writeDestination(join(directory, 'source'), destination, outputs, [], pages, written);
      expect(writes()).toStrictEqual([join(destination, 'about/index.html'), join(destination, 'index.html'), join(destination, 'styles/site.css')]);
      expect(written).toStrictEqual(new Map([['index.html', 'index.html'], ['styles/site.css', 'body {}'], ['about/index.html', 'the rendered page']]));
      await writeDestination(join(directory, 'source'), destination, outputs, [], pages, written);
      expect(writes()).toStrictEqual([]);
      expect(await walkSource(destination)).toStrictEqual(['about/index.html', 'index.html', 'styles/site.css']);
    });

    test('a file whose hash changed is written, a copy and a page alike', async ({ directory }) => {
      const destination = join(directory, 'build');
      const written = new Map<string, string>();
      await writeDestination(join(directory, 'source'), destination, copies, [], [page('team.tpl', 'team/index.html', 'the team page')], written);
      writes();
      await writeDestination(join(directory, 'source'), destination, [copy('about/index.html', 'edited'), copy('index.html')], [], [page('team.tpl', 'team/index.html', 'the team page, edited')], written);
      expect(writes()).toStrictEqual([join(destination, 'about/index.html'), join(destination, 'team/index.html')]);
      expect(written.get('about/index.html')).toBe('edited');
      expect(await readFile(join(destination, 'team/index.html'), 'utf8')).toBe('the team page, edited');
    });

    test('a planned file removed from the destination is written again though the table has it', async ({ directory }) => {
      const destination = join(directory, 'build');
      const written = new Map<string, string>();
      await writeDestination(join(directory, 'source'), destination, copies, [], [], written);
      await rm(join(destination, 'about'), { recursive: true });
      writes();
      await writeDestination(join(directory, 'source'), destination, copies, [], [], written);
      expect(writes()).toStrictEqual([join(destination, 'about/index.html')]);
      expect(await walkSource(destination)).toStrictEqual(planned);
    });

    test('a path the clean pass removes leaves the table, with everything under it', async ({ directory }) => {
      const destination = join(directory, 'build');
      const written = new Map<string, string>();
      await writeDestination(join(directory, 'source'), destination, copies, [], [page('team.tpl', 'about/team/index.html', 'the team page')], written);
      await writeDestination(join(directory, 'source'), destination, [copy('index.html')], [], [], written);
      expect(written).toStrictEqual(new Map([['index.html', 'index.html']]));
    });

    test('a private output never enters the table', async ({ directory }) => {
      const destination = join(directory, 'build');
      const written = new Map<string, string>();
      await writeDestination(join(directory, 'source'), destination, [copy('index.html'), copy('_private.txt')], [], [], written);
      expect(written).toStrictEqual(new Map([['index.html', 'index.html']]));
    });
  });

  describe('emitted outputs', () => {
    test('an emitted output is written at its output path and its bytes are dropped', async ({ directory }) => {
      const destination = join(directory, 'build');
      const written = new Map<string, string>();
      const emitted = produced('about.tpl', 'images/photo-300.webp', 'the derivative');
      await writeDestination(join(directory, 'source'), destination, [], [emitted], [], written);
      expect(await readFile(join(destination, 'images/photo-300.webp'), 'utf8')).toBe('the derivative');
      expect(emitted.contents).toBeUndefined();
      expect(written).toStrictEqual(new Map([['images/photo-300.webp', 'the derivative']]));
    });

    // spec: docs/specs/build.md, Incremental builds
    test('an emitted output without bytes, in place with its hash written, is skipped', async ({ directory }) => {
      const destination = join(directory, 'build');
      const written = new Map<string, string>();
      const emitted = produced('about.tpl', 'images/photo-300.webp', 'the derivative');
      await writeDestination(join(directory, 'source'), destination, [], [emitted], [], written);
      writes();
      await writeDestination(join(directory, 'source'), destination, [], [emitted], [], written);
      expect(writes()).toStrictEqual([]);
      expect(await readFile(join(destination, 'images/photo-300.webp'), 'utf8')).toBe('the derivative');
    });

    // spec: docs/specs/build.md, Incremental builds
    test('an emitted output without bytes that is not skipped fails naming its path', async ({ directory }) => {
      const destination = join(directory, 'build');
      const written = new Map<string, string>();
      const emitted = produced('about.tpl', 'images/photo-300.webp', 'the derivative');
      await writeDestination(join(directory, 'source'), destination, [], [emitted], [], written);
      await rm(join(destination, 'images/photo-300.webp'));
      await expect(writeDestination(join(directory, 'source'), destination, [], [emitted], [], written)).rejects.toThrow(
        new Error('images/photo-300.webp was produced in an earlier build and is missing from the destination, so it cannot be written again.'),
      );
    });

    // spec: docs/specs/source-tree.md, Underscore prefix
    test('a private emitted output is never written and keeps its bytes', async ({ directory }) => {
      const destination = join(directory, 'build');
      const written = new Map<string, string>();
      const emitted = produced('about.tpl', '_images/photo-300.webp', 'the derivative');
      await writeDestination(join(directory, 'source'), destination, [copy('index.html')], [emitted], [], written);
      expect(await walkSource(destination)).toStrictEqual(['index.html']);
      expect(emitted.contents).toStrictEqual(Buffer.from('the derivative'));
      expect(written).toStrictEqual(new Map([['index.html', 'index.html']]));
    });
  });

  // spec: docs/specs/source-tree.md, Output paths are unique
  describe('two sources with one output path', () => {
    const source = fixturePath('defaults', 'source');
    const destination = fixturePath('defaults', 'build');

    test.each([
      {
        case: 'two outputs of one source',
        outputs: [copy('index.html'), copy('about/index.html'), copy('index.html')],
        emitted: [],
        pages: [],
        message: 'index.html would be written to index.html twice.',
      },
      {
        case: "a copy and a handler's renamed output",
        outputs: [copy('styles/site.css'), handled('styles/site.scss', 'styles/site.css', '')],
        emitted: [],
        pages: [],
        message: 'Both styles/site.css and styles/site.scss would be written to styles/site.css.',
      },
      {
        case: 'a page and a copy',
        outputs: [copy('about/index.html')],
        emitted: [],
        pages: [page('about.tpl', 'about/index.html')],
        message: 'Both about.tpl and about/index.html would be written to about/index.html.',
      },
      {
        case: 'an emitted output and a copy',
        outputs: [copy('images/photo.webp')],
        emitted: [produced('index.tpl', 'images/photo.webp', '')],
        pages: [],
        message: 'Both images/photo.webp and index.tpl would be written to images/photo.webp.',
      },
      {
        case: 'an emitted output and a page',
        outputs: [],
        emitted: [produced('index.tpl', 'about/index.html', '')],
        pages: [page('about.tpl', 'about/index.html')],
        message: 'Both about.tpl and index.tpl would be written to about/index.html.',
      },
      {
        case: 'a page beside a directory index with the same URL',
        outputs: [],
        emitted: [],
        pages: [page('about.tpl', 'about/index.html'), page('about/index.tpl', 'about/index.html')],
        message: 'Both about.tpl and about/index.tpl would be written to about/index.html.',
      },
      {
        case: 'two pages with one name and different extensions, named in sorted order',
        outputs: [],
        emitted: [],
        pages: [page('about.tpl', 'about/index.html'), page('about.md', 'about/index.html')],
        message: 'Both about.md and about.tpl would be written to about/index.html.',
      },
    ])('$case fail naming both', async ({ outputs, emitted, pages, message }) => {
      await expect(writeDestination(source, destination, outputs, emitted, pages, new Map())).rejects.toThrow(new Error(message));
      await assertAbsent(destination);
    });
  });
});
