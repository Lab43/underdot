// spec: q-docs/specs/templates.md, Data files

import { describe, expect, test } from 'vitest';
import type { Helper } from '../plugins/register-plugins.ts';
import type { HookGlobal } from '../plugins/run-page-hooks.ts';
import { defineGlobals } from './define-globals.ts';

const here: Helper = (context) => context.sourcePath;
const helpers = new Map([['team', { pluginName: 'tools', helper: here }]]);
const none = new Map<string, { pluginName: string; helper: Helper }>();

const pages: HookGlobal = { name: 'pages', pluginName: 'listing', value: ['/'], version: 'pages' };
const team: HookGlobal = { name: 'team', pluginName: 'listing', value: ['Ada'], version: 'pages' };

describe('defineGlobals', () => {
  test('no data variables return a copy of the globals', () => {
    const globals = { siteName: 'Site' };
    const defined = defineGlobals(globals, [], [], none);
    expect(defined).toStrictEqual(globals);
    expect(defined).not.toBe(globals);
  });

  test('data variables alone come back under their names', () => {
    expect(defineGlobals({}, [
      { name: 'site', sourcePath: '_data/site.json', value: { year: 2024 } },
      { name: 'team', sourcePath: '_data/team', value: { size: 3 } },
    ], [], none)).toStrictEqual({ site: { year: 2024 }, team: { size: 3 } });
  });

  test('the globals and the data variables merge', () => {
    expect(defineGlobals({ siteName: 'Site' }, [{ name: 'site', sourcePath: '_data/site.json', value: { year: 2024 } }], [], helpers)).toStrictEqual({
      siteName: 'Site',
      site: { year: 2024 },
    });
  });

  test('a name a file also defines is rejected naming the setting and the file', () => {
    expect(() => defineGlobals({ team: 'Everyone' }, [{ name: 'team', sourcePath: '_data/team.json', value: [] }], [], none)).toThrow(
      new Error('Both the globals setting and _data/team.json define team.'),
    );
  });

  test('a name a directory also defines is rejected naming the setting and the directory', () => {
    expect(() => defineGlobals({ team: 'Everyone' }, [{ name: 'team', sourcePath: '_data/team', value: {} }], [], none)).toThrow(
      new Error('Both the globals setting and _data/team define team.'),
    );
  });

  // spec: q-docs/specs/plugins.md, Page hooks
  describe('hook globals', () => {
    test('hook globals merge under their names beside the globals and the data variables', () => {
      expect(defineGlobals({ siteName: 'Site' }, [{ name: 'site', sourcePath: '_data/site.json', value: { year: 2024 } }], [pages, { name: 'count', pluginName: 'counting', value: 1, version: 'pages' }], none)).toStrictEqual({
        siteName: 'Site',
        site: { year: 2024 },
        pages: ['/'],
        count: 1,
      });
    });

    test('a name the globals setting also defines is rejected naming the setting and the hook', () => {
      expect(() => defineGlobals({ pages: [] }, [], [pages], none)).toThrow(new Error('Both the globals setting and the page hook of listing define pages.'));
    });

    test('a name a data file also defines is rejected naming the file and the hook', () => {
      expect(() => defineGlobals({}, [{ name: 'team', sourcePath: '_data/team.json', value: [] }], [team], none)).toThrow(
        new Error('Both _data/team.json and the page hook of listing define team.'),
      );
    });

    test('a name an earlier hook also defines is rejected naming both hooks', () => {
      expect(() => defineGlobals({}, [], [pages, { ...pages, pluginName: 'counting' }], none)).toThrow(
        new Error('Both the page hooks of listing and counting define pages.'),
      );
    });

    // spec: q-docs/specs/plugins.md, Template helpers
    test("a hook global sharing a helper's name is rejected naming the hook and the plugin", () => {
      expect(() => defineGlobals({}, [], [team], helpers)).toThrow(new Error('Both the page hook of listing and the plugin tools define team.'));
    });
  });

  // spec: q-docs/specs/plugins.md, Template helpers
  test("a global sharing a helper's name is rejected naming the setting and the plugin", () => {
    expect(() => defineGlobals({ team: 'Everyone' }, [], [], helpers)).toThrow(new Error('Both the globals setting and the plugin tools define team.'));
  });

  // spec: q-docs/specs/plugins.md, Template helpers
  test("a data variable sharing a helper's name is rejected naming the file and the plugin", () => {
    expect(() => defineGlobals({}, [{ name: 'team', sourcePath: '_data/team.json', value: [] }], [], helpers)).toThrow(
      new Error('Both _data/team.json and the plugin tools define team.'),
    );
  });
});
