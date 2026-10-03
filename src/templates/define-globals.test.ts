// spec: docs/specs/templates.md, Data files

import { describe, expect, test } from 'vitest';
import { defineGlobals } from './define-globals.ts';

describe('defineGlobals', () => {
  test('no data variables return a copy of the globals', () => {
    const globals = { siteName: 'Site' };
    const defined = defineGlobals(globals, []);
    expect(defined).toStrictEqual(globals);
    expect(defined).not.toBe(globals);
  });

  test('data variables alone come back under their names', () => {
    expect(defineGlobals({}, [
      { name: 'site', sourcePath: '_data/site.json', value: { year: 2024 } },
      { name: 'team', sourcePath: '_data/team', value: { size: 3 } },
    ])).toStrictEqual({ site: { year: 2024 }, team: { size: 3 } });
  });

  test('the globals and the data variables merge', () => {
    expect(defineGlobals({ siteName: 'Site' }, [{ name: 'site', sourcePath: '_data/site.json', value: { year: 2024 } }])).toStrictEqual({
      siteName: 'Site',
      site: { year: 2024 },
    });
  });

  test('a name a file also defines is rejected naming the setting and the file', () => {
    expect(() => defineGlobals({ team: 'Everyone' }, [{ name: 'team', sourcePath: '_data/team.json', value: [] }])).toThrow(
      new Error('Both the globals setting and _data/team.json define team.'),
    );
  });

  test('a name a directory also defines is rejected naming the setting and the directory', () => {
    expect(() => defineGlobals({ team: 'Everyone' }, [{ name: 'team', sourcePath: '_data/team', value: {} }])).toThrow(
      new Error('Both the globals setting and _data/team define team.'),
    );
  });
});
