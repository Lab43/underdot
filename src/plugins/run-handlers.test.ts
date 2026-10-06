// spec: docs/specs/plugins.md, File handlers

import { setTimeout } from 'node:timers/promises';
import { describe, expect, test, vi } from 'vitest';
import type { FileHandler, RegisteredHandler } from './register-plugins.ts';
import { runHandlers } from './run-handlers.ts';
import type { HandledFile, HandlerOutput } from './run-handlers.ts';

const file = (outputPath: string, text: string): HandledFile => ({ outputPath, contents: Buffer.from(text) });

const handler = (glob: string, handle: FileHandler, pluginName = 'fixture'): RegisteredHandler => ({ pluginName, glob, handle });

const upper: FileHandler = ({ outputPath, contents }) => [{ outputPath, contents: contents.toString().toUpperCase() }];
const rename: FileHandler = ({ outputPath, contents }) => [{ outputPath: outputPath.replace(/\.txt$/, '.text'), contents }];
const annotate: FileHandler = ({ outputPath, contents }) => [{ outputPath, contents: `${contents.toString()} [annotated]` }];

describe('runHandlers', () => {
  test("a matching handler's output replaces the file", async () => {
    await expect(runHandlers('notes.txt', file('notes.txt', 'notes'), [handler('**/*.txt', upper)])).resolves.toStrictEqual([file('notes.txt', 'NOTES')]);
  });

  test('a handler renames a file', async () => {
    await expect(runHandlers('notes.txt', file('notes.txt', 'notes'), [handler('**/*.txt', rename)])).resolves.toStrictEqual([file('notes.text', 'notes')]);
  });

  test('a handler splits a file into two', async () => {
    const split: FileHandler = ({ outputPath, contents }) => [{ outputPath, contents }, { outputPath: `${outputPath}.map`, contents: '{}' }];
    await expect(runHandlers('site.css', file('site.css', 'body {}'), [handler('**/*.css', split)])).resolves.toStrictEqual([file('site.css', 'body {}'), file('site.css.map', '{}')]);
  });

  test('a handler drops a file by returning nothing', async () => {
    await expect(runHandlers('scratch.drop', file('scratch.drop', 'x'), [handler('**/*.drop', () => [])])).resolves.toStrictEqual([]);
  });

  test('two handlers on one glob run in order', async () => {
    const handlers = [handler('**/*.txt', upper, 'first'), handler('**/*.txt', annotate, 'second')];
    await expect(runHandlers('notes.txt', file('notes.txt', 'notes'), handlers)).resolves.toStrictEqual([file('notes.txt', 'NOTES [annotated]')]);
  });

  test('a handler matching the path a rename produced runs on it', async () => {
    const handlers = [handler('**/*.txt', rename, 'first'), handler('**/*.text', annotate, 'second')];
    await expect(runHandlers('notes.txt', file('notes.txt', 'notes'), handlers)).resolves.toStrictEqual([file('notes.text', 'notes [annotated]')]);
  });

  test('a file matching no handler passes through unchanged', async () => {
    const handle = vi.fn<FileHandler>(upper);
    const original = file('site.css', 'body {}');
    await expect(runHandlers('site.css', original, [handler('**/*.txt', handle)])).resolves.toStrictEqual([original]);
    expect(handle).not.toHaveBeenCalled();
  });

  test('a string result and a Uint8Array result both become Buffers', async () => {
    const bytes: FileHandler = ({ outputPath }) => [{ outputPath, contents: new Uint8Array([104, 105]) }];
    const [fromString] = await runHandlers('a.txt', file('a.txt', 'x'), [handler('**/*.txt', () => [{ outputPath: 'a.txt', contents: 'hi' }])]);
    const [fromBytes] = await runHandlers('a.txt', file('a.txt', 'x'), [handler('**/*.txt', bytes)]);
    expect(fromString?.contents).toBeInstanceOf(Buffer);
    expect(fromBytes?.contents).toBeInstanceOf(Buffer);
    expect(fromString?.contents.toString()).toBe('hi');
    expect(fromBytes?.contents.toString()).toBe('hi');
  });

  test('a dotfile matches', async () => {
    await expect(runHandlers('.well-known/x.txt', file('.well-known/x.txt', 'x'), [handler('**/*.txt', upper)])).resolves.toStrictEqual([file('.well-known/x.txt', 'X')]);
  });

  test('an asynchronous handler is awaited', async () => {
    const slow: FileHandler = async ({ outputPath }) => {
      await setTimeout(1);
      return [{ outputPath, contents: 'slow' }];
    };
    await expect(runHandlers('a.txt', file('a.txt', 'x'), [handler('**/*.txt', slow)])).resolves.toStrictEqual([file('a.txt', 'slow')]);
  });

  test('a handler returning anything but an array fails naming the plugin and the glob', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a forgotten return gives
    const forgetful = (() => undefined) as unknown as FileHandler;
    await expect(runHandlers('a.txt', file('a.txt', 'x'), [handler('**/*.txt', forgetful, 'sloppy')])).rejects.toThrow(
      new Error('The handler sloppy registers for **/*.txt must return an array of files.'),
    );
  });

  test('a handler returning the Buffer it received passes', async () => {
    const original = file('a.txt', 'x');
    await expect(runHandlers('a.txt', original, [handler('**/*.txt', ({ outputPath, contents }) => [{ outputPath, contents }])])).resolves.toStrictEqual([original]);
  });

  test.each(['../x', '/x', 'a/./b', 'a//b', 'a/b/', '', 42])('an output path of %j fails naming the plugin and the glob', async (outputPath) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can return
    const output = { outputPath, contents: 'x' } as unknown as HandlerOutput;
    await expect(runHandlers('a.txt', file('a.txt', 'x'), [handler('**/*.txt', () => [output], 'sloppy')])).rejects.toThrow(
      new Error(`The handler sloppy registers for **/*.txt returned a file at ${JSON.stringify(outputPath)}, which is not a plain path under the destination.`),
    );
  });

  test.each([undefined, 42])('contents of %j fail naming the plugin and the glob', async (contents) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can return
    const output = { outputPath: 'a.txt', contents } as unknown as HandlerOutput;
    await expect(runHandlers('a.txt', file('a.txt', 'x'), [handler('**/*.txt', () => [output], 'sloppy')])).rejects.toThrow(
      new Error('The handler sloppy registers for **/*.txt returned a.txt with contents that are neither text nor bytes.'),
    );
  });

  // spec: docs/specs/plugins.md, Errors
  test("a handler's throw is reported as the source file's handling failing in the plugin, with the throw as cause", async () => {
    const cause = new Error('boom');
    const handling = runHandlers('notes.txt', file('notes.txt', 'x'), [handler('**/*.txt', () => { throw cause; })]);
    await expect(handling).rejects.toThrow(new Error('Handling notes.txt failed in fixture: boom'));
    await expect(handling).rejects.toHaveProperty('cause', cause);
  });
});
