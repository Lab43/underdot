// spec: q-docs/specs/templates.md, Data files

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { makeReporter } from '../../test/helpers/make-reporter.ts';
import { test } from '../../test/helpers/test.ts';
import { hashFiles } from '../build/hash-files.ts';
import type { FileTable } from '../build/hash-files.ts';
import type { UnitRecords } from '../build/reuse-unit.ts';
import { readData } from './read-data.ts';

vi.mock('node:fs/promises', { spy: true });

// A source nothing reads, for the rules a path alone decides.
const unread = '/site/source';

// A table with no entries, for a call whose reads are not reused.
const unhashed: FileTable = new Map();

const dataPaths = ['_data/site.json', '_data/team/leads.json', '_data/team/motto.ts', '_data/team/size.js'];

describe('readData', () => {
  test('a path outside _data is ignored', async () => {
    await expect(readData(unread, ['index.tpl', '_includes/data.json', 'data/team.json'], unhashed, new Map(), makeReporter())).resolves.toStrictEqual([]);
  });

  test('a file that is not JSON or a module is rejected before any read', async () => {
    await expect(readData(unread, ['_data/team.txt'], unhashed, new Map(), makeReporter())).rejects.toThrow(
      new Error('The data file _data/team.txt must be a .json, .js, or .ts file.'),
    );
  });

  describe('a reserved name', () => {
    test.each([
      ['_data/_site.json', '_site'],
      ['_data/team/_leads.json', 'team._leads'],
      ['_data/_team/leads.json', '_team'],
    ])('%s is rejected naming %s', async (sourcePath, variable) => {
      await expect(readData(unread, [sourcePath], unhashed, new Map(), makeReporter())).rejects.toThrow(
        new Error(`The data variable ${variable} from ${sourcePath} starts with an underscore, which is reserved.`),
      );
    });
  });

  test('the templated fixture yields a variable per top-level name, each from its file or its directory', async () => {
    const source = join(fixturePath('templated'), 'source');
    await expect(readData(source, [...dataPaths, 'index.tpl'], unhashed, new Map(), makeReporter())).resolves.toStrictEqual([
      { name: 'site', sourcePath: '_data/site.json', value: { year: 2024 } },
      { name: 'team', sourcePath: '_data/team', value: { leads: ['Ada', 'Grace'], motto: 'Ship it', size: 3 } },
    ]);
  });

  test("malformed JSON is rejected naming the file ahead of the parser's message", async () => {
    const source = join(fixturePath('bad-data'), 'source');
    await expect(readData(source, ['_data/site.json'], unhashed, new Map(), makeReporter())).rejects.toThrow(/^_data\/site\.json: .+JSON/);
  });

  test('a module without a default export is rejected', async () => {
    const source = join(fixturePath('data-without-default'), 'source');
    await expect(readData(source, ['_data/site.ts'], unhashed, new Map(), makeReporter())).rejects.toThrow(
      new Error('The data file _data/site.ts has no default export.'),
    );
  });

  test('two files with one name are rejected naming both', async () => {
    const source = join(fixturePath('duplicate-data'), 'source');
    await expect(readData(source, ['_data/team.json', '_data/team.ts'], unhashed, new Map(), makeReporter())).rejects.toThrow(
      new Error('Both _data/team.json and _data/team.ts define team.'),
    );
  });

  describe('a file and a directory with one name', () => {
    const source = join(fixturePath('data-file-and-directory'), 'source');

    test('are rejected naming both, the file first', async () => {
      await expect(readData(source, ['_data/team.json', '_data/team/leads.json'], unhashed, new Map(), makeReporter())).rejects.toThrow(
        new Error('Both _data/team.json and the directory _data/team define team.'),
      );
    });

    test('are rejected the same way when the directory comes first', async () => {
      await expect(readData(source, ['_data/team/leads.json', '_data/team.json'], unhashed, new Map(), makeReporter())).rejects.toThrow(
        new Error('Both _data/team.json and the directory _data/team define team.'),
      );
    });
  });

  // spec: q-docs/specs/build.md, Incremental builds
  describe('across two calls with one table', () => {
    test.override({ fixture: 'templated' });

    test('a JSON file is parsed once', async ({ directory }) => {
      const source = join(directory, 'source');
      const files = await hashFiles(source, dataPaths, new Map());
      const records: UnitRecords<unknown> = new Map();
      vi.mocked(readFile).mockClear();
      const first = await readData(source, dataPaths, files, records, makeReporter());
      const second = await readData(source, dataPaths, files, records, makeReporter());
      expect(vi.mocked(readFile)).toHaveBeenCalledTimes(2);
      expect(second).toStrictEqual(first);
    });

    test('a changed module reloads', async ({ directory }) => {
      const source = join(directory, 'source');
      const first = await hashFiles(source, dataPaths, new Map());
      const records: UnitRecords<unknown> = new Map();
      await readData(source, dataPaths, first, records, makeReporter());
      await writeFile(join(source, '_data/team/motto.ts'), "export default 'Ship it now';\n");
      const second = await hashFiles(source, dataPaths, first);
      const variables = await readData(source, dataPaths, second, records, makeReporter());
      expect(variables[1]?.value).toStrictEqual({ leads: ['Ada', 'Grace'], motto: 'Ship it now', size: 3 });
    });
  });

  // spec: q-docs/specs/build.md, Output
  test('a read reports its label', async () => {
    const reporter = makeReporter();
    await readData(join(fixturePath('templated'), 'source'), ['_data/site.json'], unhashed, new Map(), reporter);
    expect(reporter.ran).toHaveBeenCalledExactlyOnceWith('Read _data/site.json', []);
  });
});
