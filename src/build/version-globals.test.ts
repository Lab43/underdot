// spec: docs/specs/build.md, Incremental builds

import { describe, expect, test } from 'vitest';
import type { FileEntry, FileTable } from './hash-files.ts';
import { versionGlobals } from './version-globals.ts';

const entry = (hash: string): FileEntry => ({ mtimeNs: 1n, size: 1n, hash });

const files: FileTable = new Map([
  ['_data/site.json', entry('site')],
  ['_data/team.json', entry('teamfile')],
  ['_data/team/leads.json', entry('leads')],
  ['_data/team/motto.ts', entry('motto')],
  ['index.tpl', entry('home')],
]);

describe('versionGlobals', () => {
  test('a configuration global versions as a constant', () => {
    expect(versionGlobals({ siteName: 'Site' }, [], [], files)).toStrictEqual(new Map([['siteName', 'configuration']]));
  });

  test("a data file's variable versions by the file's hash", () => {
    expect(versionGlobals({}, [{ name: 'site', sourcePath: '_data/site.json', value: {} }], [], files)).toStrictEqual(new Map([['site', '_data/site.json:site']]));
  });

  test("a data directory's variable versions by every file under it in path order, and never by a file whose name the directory begins", () => {
    expect(versionGlobals({}, [{ name: 'team', sourcePath: '_data/team', value: {} }], [], files)).toStrictEqual(
      new Map([['team', '_data/team/leads.json:leads\n_data/team/motto.ts:motto']]),
    );
  });

  test("a directory's version changes when one file's hash does", () => {
    const changed: FileTable = new Map([...files, ['_data/team/motto.ts', entry('motto2')]]);
    const variables = [{ name: 'team', sourcePath: '_data/team', value: {} }];
    expect(versionGlobals({}, variables, [], changed).get('team')).not.toBe(versionGlobals({}, variables, [], files).get('team'));
  });

  test("a hook global versions by the hook's version", () => {
    expect(versionGlobals({}, [], [{ name: 'pages', pluginName: 'listing', value: [], version: 'pages1' }], files)).toStrictEqual(new Map([['pages', 'pages1']]));
  });
});
