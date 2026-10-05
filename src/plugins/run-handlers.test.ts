// spec: docs/specs/plugins.md, File handlers

import { setTimeout } from 'node:timers/promises';
import { describe, expect, test, vi } from 'vitest';
import type { FileHandler, RegisteredHandler } from './register-plugins.ts';
import { runHandlers } from './run-handlers.ts';
import type { HandledFile } from './run-handlers.ts';

const file = (outputPath: string, text: string): HandledFile => ({ outputPath, contents: Buffer.from(text) });

const handler = (glob: string, handle: FileHandler, pluginName = 'fixture'): RegisteredHandler => ({ pluginName, glob, handle });

const upper: FileHandler = ({ outputPath, contents }) => [{ outputPath, contents: contents.toString().toUpperCase() }];
const rename: FileHandler = ({ outputPath, contents }) => [{ outputPath: outputPath.replace(/\.txt$/, '.text'), contents }];
const annotate: FileHandler = ({ outputPath, contents }) => [{ outputPath, contents: `${contents.toString()} [annotated]` }];

describe('runHandlers', () => {
  test("a matching handler's output replaces the file", async () => {
    await expect(runHandlers(file('notes.txt', 'notes'), [handler('**/*.txt', upper)])).resolves.toStrictEqual([file('notes.txt', 'NOTES')]);
  });

  test('a handler renames a file', async () => {
    await expect(runHandlers(file('notes.txt', 'notes'), [handler('**/*.txt', rename)])).resolves.toStrictEqual([file('notes.text', 'notes')]);
  });

  test('a handler splits a file into two', async () => {
    const split: FileHandler = ({ outputPath, contents }) => [{ outputPath, contents }, { outputPath: `${outputPath}.map`, contents: '{}' }];
    await expect(runHandlers(file('site.css', 'body {}'), [handler('**/*.css', split)])).resolves.toStrictEqual([file('site.css', 'body {}'), file('site.css.map', '{}')]);
  });

  test('a handler drops a file by returning nothing', async () => {
    await expect(runHandlers(file('scratch.drop', 'x'), [handler('**/*.drop', () => [])])).resolves.toStrictEqual([]);
  });

  test('two handlers on one glob run in order', async () => {
    const handlers = [handler('**/*.txt', upper, 'first'), handler('**/*.txt', annotate, 'second')];
    await expect(runHandlers(file('notes.txt', 'notes'), handlers)).resolves.toStrictEqual([file('notes.txt', 'NOTES [annotated]')]);
  });

  test('a handler matching the path a rename produced runs on it', async () => {
    const handlers = [handler('**/*.txt', rename, 'first'), handler('**/*.text', annotate, 'second')];
    await expect(runHandlers(file('notes.txt', 'notes'), handlers)).resolves.toStrictEqual([file('notes.text', 'notes [annotated]')]);
  });

  test('a file matching no handler passes through unchanged', async () => {
    const handle = vi.fn<FileHandler>(upper);
    const original = file('site.css', 'body {}');
    await expect(runHandlers(original, [handler('**/*.txt', handle)])).resolves.toStrictEqual([original]);
    expect(handle).not.toHaveBeenCalled();
  });

  test('a string result and a Uint8Array result both become Buffers', async () => {
    const bytes: FileHandler = ({ outputPath }) => [{ outputPath, contents: new Uint8Array([104, 105]) }];
    const [fromString] = await runHandlers(file('a.txt', 'x'), [handler('**/*.txt', () => [{ outputPath: 'a.txt', contents: 'hi' }])]);
    const [fromBytes] = await runHandlers(file('a.txt', 'x'), [handler('**/*.txt', bytes)]);
    expect(fromString?.contents).toBeInstanceOf(Buffer);
    expect(fromBytes?.contents).toBeInstanceOf(Buffer);
    expect(fromString?.contents.toString()).toBe('hi');
    expect(fromBytes?.contents.toString()).toBe('hi');
  });

  test('a dotfile matches', async () => {
    await expect(runHandlers(file('.well-known/x.txt', 'x'), [handler('**/*.txt', upper)])).resolves.toStrictEqual([file('.well-known/x.txt', 'X')]);
  });

  test('an asynchronous handler is awaited', async () => {
    const slow: FileHandler = async ({ outputPath }) => {
      await setTimeout(1);
      return [{ outputPath, contents: 'slow' }];
    };
    await expect(runHandlers(file('a.txt', 'x'), [handler('**/*.txt', slow)])).resolves.toStrictEqual([file('a.txt', 'slow')]);
  });

  test('a handler returning anything but an array fails naming the plugin and the glob', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a forgotten return gives
    const forgetful = (() => undefined) as unknown as FileHandler;
    await expect(runHandlers(file('a.txt', 'x'), [handler('**/*.txt', forgetful, 'sloppy')])).rejects.toThrow(
      new Error('The handler sloppy registers for **/*.txt must return an array of files.'),
    );
  });

  test("a handler's throw propagates as it is", async () => {
    const error = new Error('compile failed');
    await expect(runHandlers(file('a.txt', 'x'), [handler('**/*.txt', () => { throw error; })])).rejects.toBe(error);
  });
});
