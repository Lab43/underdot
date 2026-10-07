// spec: docs/specs/build.md, Incremental builds

import { describe, expect, test } from 'vitest';
import type { Versions } from './bind-build.ts';
import { findVersion } from './find-version.ts';

const versions: Versions = {
  files: new Map([['index.tpl', { mtimeNs: 1n, size: 1n, hash: 'home' }]]),
  outputs: new Map([['notes.text', 'notes']]),
  globals: new Map([['site', 'site1'], ['team', 'team1']]),
  allGlobals: 'site:site1\nteam:team1',
  chains: new Map([['index.tpl', '_.tpl']]),
  bodies: new Map([['/', 'body']]),
};

describe('findVersion', () => {
  test.each([
    ['file', 'index.tpl', 'home'],
    ['output', 'notes.text', 'notes'],
    ['body', '/', 'body'],
    ['global', 'site', 'site1'],
    ['globals', '', 'site:site1\nteam:team1'],
    ['chain', 'index.tpl', '_.tpl'],
  ] as const)('%s answers from its table', (kind, name, version) => {
    expect(findVersion(versions, kind, name)).toBe(version);
  });

  test.each(['file', 'output', 'body', 'global', 'chain'] as const)('an absent %s has no version', (kind) => {
    expect(findVersion(versions, kind, 'missing')).toBeUndefined();
  });

  test('the pages have no version, since no render observes them', () => {
    expect(findVersion(versions, 'pages', '')).toBeUndefined();
  });

  test('the parameters have no version, since no render observes them', () => {
    expect(findVersion(versions, 'parameters', '')).toBeUndefined();
  });

  test("the globals' version changes when any global's version does", () => {
    const changed: Versions = { ...versions, globals: new Map([['site', 'site1'], ['team', 'team2']]), allGlobals: 'site:site1\nteam:team2' };
    expect(findVersion(changed, 'globals', '')).not.toBe(findVersion(versions, 'globals', ''));
    expect(findVersion(changed, 'global', 'site')).toBe(findVersion(versions, 'global', 'site'));
  });
});
