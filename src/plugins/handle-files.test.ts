// spec: docs/specs/plugins.md, File handlers

import { hash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { makeReporter } from '../../test/helpers/make-reporter.ts';
import { renderBody } from '../../test/helpers/render-body.ts';
import { test } from '../../test/helpers/test.ts';
import { hashFiles } from '../build/hash-files.ts';
import type { FileTable } from '../build/hash-files.ts';
import type { UnitRecords } from '../build/reuse-unit.ts';
import { classifySource } from '../source-tree/classify-source.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { handleFiles } from './handle-files.ts';
import type { Output } from './handle-files.ts';
import type { FileHandler, RegisteredHandler } from './register-plugins.ts';

const source = join(fixturePath('templated'), 'source');
const renderers = new Map([['tpl', { pluginName: 'fixture', render: renderBody }]]);

const copy = (files: FileTable, sourcePath: string): Output => ({ sourcePath, outputPath: sourcePath, contents: undefined, hash: files.get(sourcePath)?.hash ?? '' });
const handled = (sourcePath: string, outputPath: string, text: string): Output =>
  ({ sourcePath, outputPath, contents: Buffer.from(text), hash: hash('sha256', text, 'hex') });

const upper: RegisteredHandler = {
  pluginName: 'transform',
  glob: '**/*.txt',
  handle: ({ outputPath, contents }) => [{ outputPath: outputPath.replace(/\.txt$/, '.text'), contents: contents.toString().toUpperCase() }],
};
const split: RegisteredHandler = {
  pluginName: 'transform',
  glob: '**/*.css',
  handle: ({ outputPath, contents }) => [{ outputPath, contents }, { outputPath: `${outputPath}.map`, contents: '{}' }],
};

const hashSource = async (root = source): Promise<FileTable> => hashFiles(root, await walkSource(root), new Map());

describe('handleFiles', () => {
  test("with no handlers, every static file of the templated fixture yields a copy output at its own path carrying the table's hash, in the static files' order", async () => {
    const files = await hashSource();
    const { staticFiles } = classifySource([...files.keys()], renderers);
    const outputs = await handleFiles(source, staticFiles, [], files, new Map(), makeReporter());
    expect(outputs).toStrictEqual([
      copy(files, '_data/site.json'),
      copy(files, '_data/team/leads.json'),
      copy(files, '_data/team/motto.ts'),
      copy(files, '_data/team/size.js'),
      copy(files, '_includes/header.tpl'),
      copy(files, '_partial.txt'),
      copy(files, '_snippets/aside.txt'),
      copy(files, 'extra/plain.html'),
      copy(files, 'notes.txt'),
      copy(files, 'scratch.drop'),
      copy(files, 'styles/site.css'),
    ]);
    expect(outputs[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a matched file is read and yields its handled outputs carrying its source path and the hash of their bytes, an unmatched one a copy, in the static files' order", async () => {
    const files = await hashSource();
    const staticFiles = [{ sourcePath: 'styles/site.css' }, { sourcePath: 'notes.txt' }, { sourcePath: 'extra/plain.html' }, { sourcePath: '_snippets/aside.txt' }];
    await expect(handleFiles(source, staticFiles, [upper, split], files, new Map(), makeReporter())).resolves.toStrictEqual([
      handled('styles/site.css', 'styles/site.css', 'body { margin: 0; }\n'),
      handled('styles/site.css', 'styles/site.css.map', '{}'),
      handled('notes.txt', 'notes.text', 'THE NOTES FILE.\n'),
      copy(files, 'extra/plain.html'),
      handled('_snippets/aside.txt', '_snippets/aside.text', 'THE ASIDE SNIPPET.\n'),
    ]);
  });

  test('a static file the table lacks is an error naming it', async () => {
    await expect(handleFiles(source, [{ sourcePath: 'notes.txt' }], [], new Map(), new Map(), makeReporter())).rejects.toThrow(
      new Error('The static file notes.txt was not hashed.'),
    );
  });

  // spec: docs/specs/build.md, Incremental builds
  describe('across two calls with one table', () => {
    test.override({ fixture: 'templated' });

    test('no handler runs the second time', async ({ directory }) => {
      const root = join(directory, 'source');
      const files = await hashSource(root);
      const staticFiles = [{ sourcePath: 'styles/site.css' }, { sourcePath: 'notes.txt' }, { sourcePath: 'extra/plain.html' }];
      const spied = [upper, split].map((handler) => ({ ...handler, handle: vi.fn(handler.handle) }));
      const records: UnitRecords<Output[]> = new Map();
      const first = await handleFiles(root, staticFiles, spied, files, records, makeReporter());
      const second = await handleFiles(root, staticFiles, spied, files, records, makeReporter());
      expect(second).toStrictEqual(first);
      expect(spied[0]?.handle).toHaveBeenCalledTimes(1);
      expect(spied[1]?.handle).toHaveBeenCalledTimes(1);
    });

    // spec: docs/specs/plugins.md, Dependencies
    test('a handling is reused while a file its handler declared stands, reporting nothing, and reruns and warns again when it changes', async ({ directory }) => {
      const root = join(directory, 'source');
      const first = await hashSource(root);
      const declaring: RegisteredHandler = {
        pluginName: 'sass',
        glob: '**/*.css',
        handle: vi.fn<FileHandler>((file, { declareFile, warn }) => {
          declareFile('notes.txt');
          warn('Deprecated.');
          return [file];
        }),
      };
      const records: UnitRecords<Output[]> = new Map();
      const reporter = makeReporter();
      await handleFiles(root, [{ sourcePath: 'styles/site.css' }], [declaring], first, records, reporter);
      await handleFiles(root, [{ sourcePath: 'styles/site.css' }], [declaring], first, records, reporter);
      expect(declaring.handle).toHaveBeenCalledOnce();
      expect(reporter.warned).toHaveBeenCalledExactlyOnceWith('Handling styles/site.css', 'sass', 'Deprecated.');
      await writeFile(join(root, 'notes.txt'), 'The notes file, edited.\n');
      const second = await hashFiles(root, [...first.keys()], first);
      await handleFiles(root, [{ sourcePath: 'styles/site.css' }], [declaring], second, records, reporter);
      expect(declaring.handle).toHaveBeenCalledTimes(2);
      expect(reporter.warned).toHaveBeenCalledTimes(2);
    });

    test("a changed file's handlers run again and the rest are reused", async ({ directory }) => {
      const root = join(directory, 'source');
      const first = await hashSource(root);
      const staticFiles = [{ sourcePath: 'styles/site.css' }, { sourcePath: 'notes.txt' }];
      const spied = [upper, split].map((handler) => ({ ...handler, handle: vi.fn(handler.handle) }));
      const records: UnitRecords<Output[]> = new Map();
      await handleFiles(root, staticFiles, spied, first, records, makeReporter());
      await writeFile(join(root, 'notes.txt'), 'The notes file, edited.\n');
      const second = await hashFiles(root, [...first.keys()], first);
      const outputs = await handleFiles(root, staticFiles, spied, second, records, makeReporter());
      expect(outputs[2]).toStrictEqual(handled('notes.txt', 'notes.text', 'THE NOTES FILE, EDITED.\n'));
      expect(spied[0]?.handle).toHaveBeenCalledTimes(2);
      expect(spied[1]?.handle).toHaveBeenCalledTimes(1);
    });
  });
});
