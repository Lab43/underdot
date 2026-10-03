// spec: docs/specs/templates.md, Data files

import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { readData } from './read-data.ts';

// A source nothing reads, for the rules a path alone decides.
const unread = '/site/source';

describe('readData', () => {
  test('a path outside _data is ignored', async () => {
    await expect(readData(unread, ['index.tpl', '_includes/data.json', 'data/team.json'])).resolves.toStrictEqual([]);
  });

  test('a file that is not JSON or a module is rejected before any read', async () => {
    await expect(readData(unread, ['_data/team.txt'])).rejects.toThrow(
      new Error('The data file _data/team.txt must be a .json, .js, or .ts file.'),
    );
  });

  describe('a reserved name', () => {
    test.each([
      ['_data/_site.json', '_site'],
      ['_data/team/_leads.json', 'team._leads'],
      ['_data/_team/leads.json', '_team'],
    ])('%s is rejected naming %s', async (sourcePath, variable) => {
      await expect(readData(unread, [sourcePath])).rejects.toThrow(
        new Error(`The data variable ${variable} from ${sourcePath} starts with an underscore, which is reserved.`),
      );
    });
  });

  test('the templated fixture yields a variable per top-level name, each from its file or its directory', async () => {
    const source = join(fixturePath('templated'), 'source');
    const sourcePaths = ['_data/site.json', '_data/team/leads.json', '_data/team/motto.ts', '_data/team/size.js', 'index.tpl'];
    await expect(readData(source, sourcePaths)).resolves.toStrictEqual([
      { name: 'site', sourcePath: '_data/site.json', value: { year: 2024 } },
      { name: 'team', sourcePath: '_data/team', value: { leads: ['Ada', 'Grace'], motto: 'Ship it', size: 3 } },
    ]);
  });

  test("malformed JSON is rejected naming the file ahead of the parser's message", async () => {
    const source = join(fixturePath('bad-data'), 'source');
    await expect(readData(source, ['_data/site.json'])).rejects.toThrow(/^_data\/site\.json: .+JSON/);
  });

  test('a module without a default export is rejected', async () => {
    const source = join(fixturePath('data-without-default'), 'source');
    await expect(readData(source, ['_data/site.ts'])).rejects.toThrow(
      new Error('The data file _data/site.ts has no default export.'),
    );
  });

  test('two files with one name are rejected naming both', async () => {
    const source = join(fixturePath('duplicate-data'), 'source');
    await expect(readData(source, ['_data/team.json', '_data/team.ts'])).rejects.toThrow(
      new Error('Both _data/team.json and _data/team.ts define team.'),
    );
  });

  describe('a file and a directory with one name', () => {
    const source = join(fixturePath('data-file-and-directory'), 'source');

    test('are rejected naming both, the file first', async () => {
      await expect(readData(source, ['_data/team.json', '_data/team/leads.json'])).rejects.toThrow(
        new Error('Both _data/team.json and the directory _data/team define team.'),
      );
    });

    test('are rejected the same way when the directory comes first', async () => {
      await expect(readData(source, ['_data/team/leads.json', '_data/team.json'])).rejects.toThrow(
        new Error('Both _data/team.json and the directory _data/team define team.'),
      );
    });
  });
});
