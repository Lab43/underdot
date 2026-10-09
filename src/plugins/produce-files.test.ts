// spec: docs/specs/plugins.md, Emitted files

import { hash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { makeFileEntry } from '../../test/helpers/make-file-entry.ts';
import { makeReporter } from '../../test/helpers/make-reporter.ts';
import { test } from '../../test/helpers/test.ts';
import type { Reporter } from '../build/bind-reporter.ts';
import type { FileTable } from '../build/hash-files.ts';
import type { UnitRecords } from '../build/reuse-unit.ts';
import type { EmittedFile, Producer } from './bind-render-context.ts';
import type { Output } from './handle-files.ts';
import { produceFiles } from './produce-files.ts';
import type { EmittedOutput } from './produce-files.ts';
import type { RegisteredHandler } from './register-plugins.ts';

// The plugins in order: a handler before the emitting plugin and one after it.
const pluginNames = ['transform', 'images', 'annotate'];
const handlers: RegisteredHandler[] = [
  { pluginName: 'transform', glob: '**/*.txt', handle: ({ outputPath, contents }) => [{ outputPath, contents: contents.toString().toUpperCase() }] },
  { pluginName: 'annotate', glob: '**/*.txt', handle: ({ outputPath, contents }) => [{ outputPath, contents: `${contents.toString()} [annotated]` }] },
];

// A handled output, and a copy the defaults fixture holds in source.
const outputs: Output[] = [
  { sourcePath: 'notes.md', outputPath: 'notes.text', contents: Buffer.from('the notes'), hash: 'notes1' },
  { sourcePath: 'index.html', outputPath: 'index.html', contents: undefined, hash: 'index1' },
];

// A producer that reads the output it is pointed at.
const reading = (outputPath: string) => vi.fn<Producer>(({ readOutput }) => Promise.resolve(`derived from ${readOutput(outputPath)?.toString().trim() ?? 'nothing'}`));

const emit = (overrides: Partial<EmittedFile> = {}): EmittedFile => ({
  pluginName: 'images',
  sourcePath: 'about.tpl',
  outputPath: 'notes.derived.txt',
  parametersHash: 'parameters1',
  produce: reading('notes.text'),
  ...overrides,
});

const produced = (sourcePath: string, outputPath: string, text: string): EmittedOutput => ({ sourcePath, outputPath, contents: Buffer.from(text), hash: hash('sha256', text, 'hex') });

interface Memory {
  handlers?: RegisteredHandler[];
  outputs?: Output[];
  files?: FileTable;
  written?: Map<string, string>;
  records?: UnitRecords<EmittedOutput[]>;
  reporter?: Reporter;
}

const produceAll = (directory: string, emits: EmittedFile[], { handlers: registered = handlers, outputs: current = outputs, files = new Map(), written = new Map(), records = new Map(), reporter = makeReporter() }: Memory = {}) =>
  produceFiles(
    join(directory, 'source'),
    join(directory, 'build'),
    emits,
    registered,
    pluginNames,
    current,
    files,
    written,
    records,
    reporter,
  );

describe('produceFiles', () => {
  test('a producer reads handled output by its output path, and its result passes the handlers after its plugin and not before', async ({ directory }) => {
    await expect(produceAll(directory, [emit()])).resolves.toStrictEqual([produced('about.tpl', 'notes.derived.txt', 'derived from the notes [annotated]')]);
  });

  test('a copy is read from its source file, and a path no output has yields no value', async ({ directory }) => {
    const emits = [
      emit({ outputPath: 'index.derived.txt', produce: reading('index.html') }),
      emit({ outputPath: 'missing.derived.txt', produce: reading('missing.html') }),
    ];
    await expect(produceAll(directory, emits)).resolves.toStrictEqual([
      produced('about.tpl', 'index.derived.txt', 'derived from index.html [annotated]'),
      produced('about.tpl', 'missing.derived.txt', 'derived from nothing [annotated]'),
    ]);
  });

  test('bytes a producer returns pass to the handlers as they are', async ({ directory }) => {
    const bytes = Buffer.from('raw');
    const emits = [emit({ outputPath: 'raw.bin', produce: () => Promise.resolve(bytes) })];
    const [output] = await produceAll(directory, emits);
    expect(output?.contents).toBe(bytes);
  });

  test('two emits of one path with one hash are one unit, named by the first source path in order', async ({ directory }) => {
    const produce = reading('notes.text');
    const emits = [emit({ sourcePath: 'index.tpl', produce }), emit({ sourcePath: 'about.tpl', produce })];
    await expect(produceAll(directory, emits)).resolves.toStrictEqual([produced('about.tpl', 'notes.derived.txt', 'derived from the notes [annotated]')]);
    expect(produce).toHaveBeenCalledOnce();
  });

  test.each([
    {
      case: 'two plugins',
      emits: [emit(), emit({ pluginName: 'thumbnails', sourcePath: 'index.tpl' })],
      message: 'Both images and thumbnails emit notes.derived.txt.',
    },
    {
      case: 'one file with two hashes',
      emits: [emit(), emit({ parametersHash: 'parameters2' })],
      message: 'about.tpl emits notes.derived.txt twice with different inputs.',
    },
    {
      case: 'two files with two hashes, named in sorted order',
      emits: [emit({ sourcePath: 'index.tpl' }), emit({ parametersHash: 'parameters2' })],
      message: 'Both about.tpl and index.tpl emit notes.derived.txt with different inputs.',
    },
  ])('one path emitted by $case fails', async ({ emits, message }) => {
    await expect(produceAll(fixturePath('defaults'), emits)).rejects.toThrow(new Error(message));
  });

  // spec: docs/specs/plugins.md, Errors
  test("a producer's throw is attributed to the output and the emitting plugin, with the throw as cause", async ({ directory }) => {
    const cause = new Error('unsupported image format');
    const producing = produceAll(directory, [emit({ produce: () => Promise.reject(cause) })]);
    await expect(producing).rejects.toThrow(new Error('Producing notes.derived.txt failed in images: unsupported image format'));
    await expect(producing).rejects.toHaveProperty('cause', cause);
  });

  test("a producer's warning names the output and the emitting plugin", async ({ directory }) => {
    const produce: Producer = ({ warn }) => {
      warn('Deprecated.');
      return Promise.resolve('derived');
    };
    const reporter = makeReporter();
    await produceAll(directory, [emit({ produce })], { reporter });
    expect(reporter.warned).toHaveBeenCalledExactlyOnceWith('Producing notes.derived.txt', 'images', 'Deprecated.');
  });

  // A handler of the plugin after the emitting one that declares notes.md and
  // warns, under the output path, since an emitted file has no source.
  const declaring: RegisteredHandler = {
    pluginName: 'annotate',
    glob: '**/*.txt',
    handle: (file, { declareFile, warn }) => {
      declareFile('notes.md');
      warn('Deprecated.');
      return [file];
    },
  };

  // spec: docs/specs/plugins.md, Errors
  test("a handler after the emitting plugin warns naming the output's handling and its plugin", async ({ directory }) => {
    const files: FileTable = new Map([['notes.md', makeFileEntry('notes1')]]);
    const reporter = makeReporter();
    await produceAll(directory, [emit()], { handlers: [declaring], files, reporter });
    expect(reporter.warned).toHaveBeenCalledExactlyOnceWith('Handling notes.derived.txt', 'annotate', 'Deprecated.');
  });

  test('a producer that returns neither text nor bytes fails naming the plugin and the path', async ({ directory }) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript plugin can return
    const produce = (() => Promise.resolve(42)) as unknown as Producer;
    await expect(produceAll(directory, [emit({ produce })])).rejects.toThrow(new Error('The producer images gave for notes.derived.txt must return text or bytes.'));
  });

  // spec: docs/specs/build.md, Incremental builds
  describe('across two calls with one set of records', () => {
    test('a unit is reused while its parameters and the output it read stand', async ({ directory }) => {
      const produce = reading('notes.text');
      const records: UnitRecords<EmittedOutput[]> = new Map();
      const first = await produceAll(directory, [emit({ produce })], { records });
      const second = await produceAll(directory, [emit({ produce })], { records });
      expect(produce).toHaveBeenCalledOnce();
      expect(second).toStrictEqual(first);
    });

    test('a unit reruns when its parameters change', async ({ directory }) => {
      const produce = reading('notes.text');
      const records: UnitRecords<EmittedOutput[]> = new Map();
      await produceAll(directory, [emit({ produce })], { records });
      await produceAll(directory, [emit({ produce, parametersHash: 'parameters2' })], { records });
      expect(produce).toHaveBeenCalledTimes(2);
    });

    test('a unit reruns when the output it read changes', async ({ directory }) => {
      const produce = reading('notes.text');
      const records: UnitRecords<EmittedOutput[]> = new Map();
      await produceAll(directory, [emit({ produce })], { records });
      const edited: Output[] = [{ sourcePath: 'notes.md', outputPath: 'notes.text', contents: Buffer.from('the edited notes'), hash: 'notes2' }];
      await expect(produceAll(directory, [emit({ produce })], { outputs: edited, records })).resolves.toStrictEqual([
        produced('about.tpl', 'notes.derived.txt', 'derived from the edited notes [annotated]'),
      ]);
      expect(produce).toHaveBeenCalledTimes(2);
    });

    // spec: docs/specs/plugins.md, Dependencies
    test('a unit is reused while a file a handler declared stands, reporting nothing, and reruns when it changes', async ({ directory }) => {
      const produce = reading('notes.text');
      const records: UnitRecords<EmittedOutput[]> = new Map();
      const reporter = makeReporter();
      const first: FileTable = new Map([['notes.md', makeFileEntry('notes1')]]);
      await produceAll(directory, [emit({ produce })], { handlers: [declaring], files: first, records, reporter });
      await produceAll(directory, [emit({ produce })], { handlers: [declaring], files: first, records, reporter });
      expect(produce).toHaveBeenCalledOnce();
      expect(reporter.warned).toHaveBeenCalledOnce();
      const second: FileTable = new Map([['notes.md', makeFileEntry('notes2')]]);
      await produceAll(directory, [emit({ produce })], { handlers: [declaring], files: second, records, reporter });
      expect(produce).toHaveBeenCalledTimes(2);
      expect(reporter.warned).toHaveBeenCalledTimes(2);
    });

    test('a reused result is named by the file that emits the path now', async ({ directory }) => {
      const records: UnitRecords<EmittedOutput[]> = new Map();
      await produceAll(directory, [emit({ sourcePath: 'about.tpl' })], { records });
      const [output] = await produceAll(directory, [emit({ sourcePath: 'index.tpl' })], { records });
      expect(output?.sourcePath).toBe('index.tpl');
    });

    // The first call's result with its bytes dropped and its file written, as
    // the write phase leaves it.
    const writeAndDrop = async (directory: string, written: Map<string, string>, records: UnitRecords<EmittedOutput[]>, produce: Producer): Promise<void> => {
      const [output] = await produceAll(directory, [emit({ produce })], { written, records });
      if (output?.contents === undefined) {
        throw new Error('The first call produced no bytes.');
      }
      await mkdir(join(directory, 'build'), { recursive: true });
      await writeFile(join(directory, 'build', output.outputPath), output.contents);
      written.set(output.outputPath, output.hash);
      output.contents = undefined;
    };

    test('a result whose bytes were dropped is reused while its file is in place and written', async ({ directory }) => {
      const produce = reading('notes.text');
      const written = new Map<string, string>();
      const records: UnitRecords<EmittedOutput[]> = new Map();
      await writeAndDrop(directory, written, records, produce);
      const [output] = await produceAll(directory, [emit({ produce })], { written, records });
      expect(produce).toHaveBeenCalledOnce();
      expect(output?.contents).toBeUndefined();
    });

    test('a result whose bytes were dropped reruns when its file is gone', async ({ directory }) => {
      const produce = reading('notes.text');
      const written = new Map<string, string>();
      const records: UnitRecords<EmittedOutput[]> = new Map();
      await writeAndDrop(directory, written, records, produce);
      await rm(join(directory, 'build', 'notes.derived.txt'));
      await expect(produceAll(directory, [emit({ produce })], { written, records })).resolves.toStrictEqual([
        produced('about.tpl', 'notes.derived.txt', 'derived from the notes [annotated]'),
      ]);
      expect(produce).toHaveBeenCalledTimes(2);
    });

    test('a result whose bytes were dropped reruns when the table lacks its write', async ({ directory }) => {
      const produce = reading('notes.text');
      const written = new Map<string, string>();
      const records: UnitRecords<EmittedOutput[]> = new Map();
      await writeAndDrop(directory, written, records, produce);
      written.clear();
      await produceAll(directory, [emit({ produce })], { written, records });
      expect(produce).toHaveBeenCalledTimes(2);
    });

    test('a result whose bytes were dropped reruns when a directory stands at its path', async ({ directory }) => {
      const produce = reading('notes.text');
      const written = new Map<string, string>();
      const records: UnitRecords<EmittedOutput[]> = new Map();
      await writeAndDrop(directory, written, records, produce);
      await rm(join(directory, 'build', 'notes.derived.txt'));
      await mkdir(join(directory, 'build', 'notes.derived.txt'));
      await produceAll(directory, [emit({ produce })], { written, records });
      expect(produce).toHaveBeenCalledTimes(2);
    });
  });
});
