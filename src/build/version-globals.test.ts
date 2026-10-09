// spec: q-docs/specs/build.md, Incremental builds

import { describe, expect, test } from 'vitest';
import { makeFileEntry } from '../../test/helpers/make-file-entry.ts';
import type { FileTable } from './hash-files.ts';
import { versionGlobals } from './version-globals.ts';

const files: FileTable = new Map([
  ['_data/site.json', makeFileEntry('site')],
  ['_data/team.json', makeFileEntry('teamfile')],
  ['_data/team/leads.json', makeFileEntry('leads')],
  ['_data/team/motto.ts', makeFileEntry('motto')],
  ['index.tpl', makeFileEntry('home')],
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
    const changed: FileTable = new Map([...files, ['_data/team/motto.ts', makeFileEntry('motto2')]]);
    const variables = [{ name: 'team', sourcePath: '_data/team', value: {} }];
    expect(versionGlobals({}, variables, [], changed).get('team')).not.toBe(versionGlobals({}, variables, [], files).get('team'));
  });

  test("a hook global versions by the hook's version", () => {
    expect(versionGlobals({}, [], [{ name: 'pages', pluginName: 'listing', value: [], version: 'pages1' }], files)).toStrictEqual(new Map([['pages', 'pages1']]));
  });
});
