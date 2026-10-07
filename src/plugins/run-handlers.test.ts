// spec: docs/specs/plugins.md, File handlers

import { setTimeout } from 'node:timers/promises';
import { describe, expect, vi } from 'vitest';
import { makeFileEntry } from '../../test/helpers/make-file-entry.ts';
import { test } from '../../test/helpers/test.ts';
import type { FileTable } from '../build/hash-files.ts';
import type { Observe } from '../build/reuse-unit.ts';
import type { FileHandler, RegisteredHandler } from './register-plugins.ts';
import { runHandlers } from './run-handlers.ts';
import type { HandledFile, HandlerOutput } from './run-handlers.ts';

const file = (outputPath: string, text: string): HandledFile => ({ outputPath, contents: Buffer.from(text) });

// The walked files a handler may declare.
const files: FileTable = new Map(['styles/_vars.scss', '_sass/_mixins.scss'].map((sourcePath) => [sourcePath, makeFileEntry(sourcePath)]));

// Run the handlers over a file under one source root, observing into `observe`.
const run = (sourcePath: string, current: HandledFile, handlers: RegisteredHandler[], observe: Observe = vi.fn()) =>
  runHandlers(sourcePath, current, handlers, '/site/source', files, observe);

const handler = (glob: string, handle: FileHandler, pluginName = 'fixture'): RegisteredHandler => ({ pluginName, glob, handle });

const upper: FileHandler = ({ outputPath, contents }) => [{ outputPath, contents: contents.toString().toUpperCase() }];
const rename: FileHandler = ({ outputPath, contents }) => [{ outputPath: outputPath.replace(/\.txt$/, '.text'), contents }];
const annotate: FileHandler = ({ outputPath, contents }) => [{ outputPath, contents: `${contents.toString()} [annotated]` }];

describe('runHandlers', () => {
  test("a matching handler's output replaces the file", async () => {
    await expect(run('notes.txt', file('notes.txt', 'notes'), [handler('**/*.txt', upper)])).resolves.toStrictEqual([file('notes.txt', 'NOTES')]);
  });

  test('a handler renames a file', async () => {
    await expect(run('notes.txt', file('notes.txt', 'notes'), [handler('**/*.txt', rename)])).resolves.toStrictEqual([file('notes.text', 'notes')]);
  });

  test('a handler splits a file into two', async () => {
    const split: FileHandler = ({ outputPath, contents }) => [{ outputPath, contents }, { outputPath: `${outputPath}.map`, contents: '{}' }];
    await expect(run('site.css', file('site.css', 'body {}'), [handler('**/*.css', split)])).resolves.toStrictEqual([file('site.css', 'body {}'), file('site.css.map', '{}')]);
  });

  test('a handler drops a file by returning nothing', async () => {
    await expect(run('scratch.drop', file('scratch.drop', 'x'), [handler('**/*.drop', () => [])])).resolves.toStrictEqual([]);
  });

  test('two handlers on one glob run in order', async () => {
    const handlers = [handler('**/*.txt', upper, 'first'), handler('**/*.txt', annotate, 'second')];
    await expect(run('notes.txt', file('notes.txt', 'notes'), handlers)).resolves.toStrictEqual([file('notes.txt', 'NOTES [annotated]')]);
  });

  test('a handler matching the path a rename produced runs on it', async () => {
    const handlers = [handler('**/*.txt', rename, 'first'), handler('**/*.text', annotate, 'second')];
    await expect(run('notes.txt', file('notes.txt', 'notes'), handlers)).resolves.toStrictEqual([file('notes.text', 'notes [annotated]')]);
  });

  test('a file matching no handler passes through unchanged', async () => {
    const handle = vi.fn<FileHandler>(upper);
    const original = file('site.css', 'body {}');
    await expect(run('site.css', original, [handler('**/*.txt', handle)])).resolves.toStrictEqual([original]);
    expect(handle).not.toHaveBeenCalled();
  });

  test('a string result and a Uint8Array result both become Buffers', async () => {
    const bytes: FileHandler = ({ outputPath }) => [{ outputPath, contents: new Uint8Array([104, 105]) }];
    const [fromString] = await run('a.txt', file('a.txt', 'x'), [handler('**/*.txt', () => [{ outputPath: 'a.txt', contents: 'hi' }])]);
    const [fromBytes] = await run('a.txt', file('a.txt', 'x'), [handler('**/*.txt', bytes)]);
    expect(fromString?.contents).toBeInstanceOf(Buffer);
    expect(fromBytes?.contents).toBeInstanceOf(Buffer);
    expect(fromString?.contents.toString()).toBe('hi');
    expect(fromBytes?.contents.toString()).toBe('hi');
  });

  test('a dotfile matches', async () => {
    await expect(run('.well-known/x.txt', file('.well-known/x.txt', 'x'), [handler('**/*.txt', upper)])).resolves.toStrictEqual([file('.well-known/x.txt', 'X')]);
  });

  test('an asynchronous handler is awaited', async () => {
    const slow: FileHandler = async ({ outputPath }) => {
      await setTimeout(1);
      return [{ outputPath, contents: 'slow' }];
    };
    await expect(run('a.txt', file('a.txt', 'x'), [handler('**/*.txt', slow)])).resolves.toStrictEqual([file('a.txt', 'slow')]);
  });

  test('a handler returning anything but an array fails naming the plugin and the glob', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a forgotten return gives
    const forgetful = (() => undefined) as unknown as FileHandler;
    await expect(run('a.txt', file('a.txt', 'x'), [handler('**/*.txt', forgetful, 'sloppy')])).rejects.toThrow(
      new Error('The handler sloppy registers for **/*.txt must return an array of files.'),
    );
  });

  test('a handler returning the Buffer it received passes', async () => {
    const original = file('a.txt', 'x');
    await expect(run('a.txt', original, [handler('**/*.txt', ({ outputPath, contents }) => [{ outputPath, contents }])])).resolves.toStrictEqual([original]);
  });

  test.each(['../x', '/x', 'a/./b', 'a//b', 'a/b/', '', 42])('an output path of %j fails naming the plugin and the glob', async (outputPath) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can return
    const output = { outputPath, contents: 'x' } as unknown as HandlerOutput;
    await expect(run('a.txt', file('a.txt', 'x'), [handler('**/*.txt', () => [output], 'sloppy')])).rejects.toThrow(
      new Error(`The handler sloppy registers for **/*.txt returned a file at ${JSON.stringify(outputPath)}, which is not a plain path under the destination.`),
    );
  });

  test.each([undefined, 42])('contents of %j fail naming the plugin and the glob', async (contents) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can return
    const output = { outputPath: 'a.txt', contents } as unknown as HandlerOutput;
    await expect(run('a.txt', file('a.txt', 'x'), [handler('**/*.txt', () => [output], 'sloppy')])).rejects.toThrow(
      new Error('The handler sloppy registers for **/*.txt returned a.txt with contents that are neither text nor bytes.'),
    );
  });

  describe('the context', () => {
    // A handler for SCSS, of the plugin `sass`, declaring the paths given.
    const declaring = (...declaredPaths: string[]): RegisteredHandler => handler('**/*.scss', (_file, { declareFile }) => {
      for (const declaredPath of declaredPaths) {
        declareFile(declaredPath);
      }
      return [];
    }, 'sass');

    test('a handler receives the source root, the declare, and the warn', async () => {
      const handle = vi.fn<FileHandler>(() => []);
      await run('styles/site.scss', file('styles/site.scss', ''), [handler('**/*.scss', handle)]);
      expect(handle).toHaveBeenCalledExactlyOnceWith(file('styles/site.scss', ''), {
        sourceDirectory: '/site/source',
        declareFile: expect.any(Function),
        warn: expect.any(Function),
      });
    });

    // spec: docs/specs/plugins.md, Reading and writing
    test('a declared file is observed as a file input', async () => {
      const observe = vi.fn<Observe>();
      await run('styles/site.scss', file('styles/site.scss', ''), [declaring('styles/_vars.scss', '_sass/_mixins.scss')], observe);
      expect(observe.mock.calls).toStrictEqual([['file', 'styles/_vars.scss'], ['file', '_sass/_mixins.scss']]);
    });

    // spec: docs/specs/plugins.md, Reading and writing
    test.each(['../outside.scss', '/etc/vars.scss', 'styles//_vars.scss', 'styles/./_vars.scss', ''])(
      'declaring %j fails as the handling, naming the path, and observes nothing',
      async (declaredPath) => {
        const observe = vi.fn<Observe>();
        await expect(run('styles/site.scss', file('styles/site.scss', ''), [declaring(declaredPath)], observe)).rejects.toThrow(
          new Error(`Handling styles/site.scss failed in sass: The handler declares ${JSON.stringify(declaredPath)}, which is not a plain path under the source root.`),
        );
        expect(observe).not.toHaveBeenCalled();
      },
    );

    // spec: docs/specs/plugins.md, Reading and writing
    test('declaring a file the build does not see fails as the handling, naming the path, and observes nothing', async () => {
      const observe = vi.fn<Observe>();
      await expect(run('styles/site.scss', file('styles/site.scss', ''), [declaring('styles/_missing.scss')], observe)).rejects.toThrow(
        new Error('Handling styles/site.scss failed in sass: The handler declares styles/_missing.scss, which the build does not see.'),
      );
      expect(observe).not.toHaveBeenCalled();
    });

    // spec: docs/specs/plugins.md, Errors
    test("a handler's warning names the source file's handling and the plugin", async ({ stderr }) => {
      const warning = handler('**/*.text', (_file, { warn }) => {
        warn('Deprecated.');
        return [];
      }, 'annotate');
      await run('notes.txt', file('notes.txt', 'notes'), [handler('**/*.txt', rename), warning]);
      expect(stderr).toStrictEqual(['Handling notes.txt warned in annotate: Deprecated.\n']);
    });
  });

  // spec: docs/specs/plugins.md, Errors
  test("a handler's throw is reported as the source file's handling failing in the plugin, with the throw as cause", async () => {
    const cause = new Error('boom');
    const handling = run('notes.txt', file('notes.txt', 'x'), [handler('**/*.txt', () => { throw cause; })]);
    await expect(handling).rejects.toThrow(new Error('Handling notes.txt failed in fixture: boom'));
    await expect(handling).rejects.toHaveProperty('cause', cause);
  });
});
