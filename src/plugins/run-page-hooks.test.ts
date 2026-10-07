// spec: docs/specs/plugins.md, Page hooks

import { setTimeout } from 'node:timers/promises';
import { describe, expect, vi } from 'vitest';
import { makePage } from '../../test/helpers/make-page.ts';
import { test } from '../../test/helpers/test.ts';
import type { UnitRecords } from '../build/reuse-unit.ts';
import type { PageHook, RegisteredHook } from './register-plugins.ts';
import { runPageHooks } from './run-page-hooks.ts';
import type { HookGlobal, HookPage } from './run-page-hooks.ts';

const pages = [
  makePage({ sourcePath: 'index.tpl', frontmatter: { title: 'Home' }, template: undefined, body: 'The home page.' }),
  makePage({ sourcePath: 'blog/hello.tpl', outputPath: 'blog/hello/index.html', url: '/blog/hello/', frontmatter: { title: 'Hello' }, template: 'post', body: 'The hello post.' }),
];

const seen: HookPage[] = [
  { sourcePath: 'index.tpl', outputPath: 'index.html', url: '/', frontmatter: { title: 'Home' } },
  { sourcePath: 'blog/hello.tpl', outputPath: 'blog/hello/index.html', url: '/blog/hello/', frontmatter: { title: 'Hello' } },
];

const hook = (pluginName: string, hook: PageHook): RegisteredHook => ({ pluginName, hook });

// Records no earlier run filled.
const fresh = (): UnitRecords<HookGlobal[]> => new Map();

describe('runPageHooks', () => {
  test("a hook receives each page's source path, output path, URL, and frontmatter and nothing else, in the pages' order", async () => {
    const listing = vi.fn<PageHook>(() => ({}));
    await runPageHooks(pages, [hook('listing', listing)], fresh());
    expect(listing).toHaveBeenCalledExactlyOnceWith(seen, { warn: expect.any(Function) });
  });

  test('two hooks receive the same list', async () => {
    const first = vi.fn<PageHook>(() => ({}));
    const second = vi.fn<PageHook>(() => ({}));
    await runPageHooks(pages, [hook('first', first), hook('second', second)], fresh());
    expect(second.mock.calls[0]?.[0]).toBe(first.mock.calls[0]?.[0]);
  });

  test("the globals come back under their names with each plugin's name, in plugin order", async () => {
    const hooks = [
      hook('listing', (hookPages) => ({ pages: hookPages.map(({ url }) => url), count: hookPages.length })),
      hook('tags', () => ({ tags: ['news'] })),
    ];
    await expect(runPageHooks(pages, hooks, fresh())).resolves.toStrictEqual([
      { name: 'pages', pluginName: 'listing', value: ['/', '/blog/hello/'], version: expect.stringMatching(/^[0-9a-f]{64}$/) },
      { name: 'count', pluginName: 'listing', value: 2, version: expect.any(String) },
      { name: 'tags', pluginName: 'tags', value: ['news'], version: expect.any(String) },
    ]);
  });

  test('no hooks define no globals', async () => {
    await expect(runPageHooks(pages, [], fresh())).resolves.toStrictEqual([]);
  });

  test('an asynchronous hook is awaited, and the next hook starts only once it has settled', async () => {
    const calls: string[] = [];
    const slow: PageHook = async () => {
      calls.push('slow starts');
      await setTimeout(10);
      calls.push('slow settles');
      return { slow: true };
    };
    const fast: PageHook = () => {
      calls.push('fast starts');
      return { fast: true };
    };
    await expect(runPageHooks(pages, [hook('first', slow), hook('second', fast)], fresh())).resolves.toStrictEqual([
      { name: 'slow', pluginName: 'first', value: true, version: expect.any(String) },
      { name: 'fast', pluginName: 'second', value: true, version: expect.any(String) },
    ]);
    expect(calls).toStrictEqual(['slow starts', 'slow settles', 'fast starts']);
  });

  test.each([undefined, null, ['pages'], 'pages'])('a hook returning %j fails naming the plugin', async (returned) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can return
    const forgetful = (() => returned) as unknown as PageHook;
    await expect(runPageHooks(pages, [hook('listing', forgetful)], fresh())).rejects.toThrow(new Error('The page hook of listing must return an object of globals.'));
  });

  test('a global starting with an underscore fails naming it and the plugin', async () => {
    await expect(runPageHooks(pages, [hook('listing', () => ({ _pages: [] }))], fresh())).rejects.toThrow(
      new Error('The global _pages from the page hook of listing starts with an underscore, which is reserved.'),
    );
  });

  // spec: docs/specs/plugins.md, Errors
  test("a hook's throw is reported as the page hook failing in the plugin, with the throw as cause", async () => {
    const cause = new Error('boom');
    const running = runPageHooks(pages, [hook('listing', () => { throw cause; })], fresh());
    await expect(running).rejects.toThrow(new Error('Running the page hook failed in listing: boom'));
    await expect(running).rejects.toHaveProperty('cause', cause);
  });

  // spec: docs/specs/plugins.md, Errors
  test("a hook's warning names the page hook and the plugin", async ({ stderr }) => {
    const listing: PageHook = (_pages, { warn }) => {
      warn('Deprecated.');
      return {};
    };
    await runPageHooks(pages, [hook('listing', listing)], fresh());
    expect(stderr).toStrictEqual(['Running the page hook warned in listing: Deprecated.\n']);
  });

  // spec: docs/specs/build.md, Incremental builds
  describe('across two calls with one set of records', () => {
    test('a reused hook prints nothing', async ({ stderr }) => {
      const listing: PageHook = (_pages, { warn }) => {
        warn('Deprecated.');
        return {};
      };
      const records = fresh();
      await runPageHooks(pages, [hook('listing', listing)], records);
      await runPageHooks(pages, [hook('listing', listing)], records);
      expect(stderr).toHaveLength(1);
    });

    const versionsOf = (globals: HookGlobal[]): string[] => globals.map(({ version }) => version);

    test('the same pages call no hook the second time, and every global of one run carries one version', async () => {
      const listing = vi.fn<PageHook>(() => ({ pages: [], count: 0 }));
      const tags = vi.fn<PageHook>(() => ({ tags: [] }));
      const records = fresh();
      const first = await runPageHooks(pages, [hook('listing', listing), hook('tags', tags)], records);
      const second = await runPageHooks(pages.map((page) => ({ ...page, body: 'edited' })), [hook('listing', listing), hook('tags', tags)], records);
      expect(listing).toHaveBeenCalledTimes(1);
      expect(tags).toHaveBeenCalledTimes(1);
      expect(second).toStrictEqual(first);
      expect(new Set(versionsOf(first)).size).toBe(1);
    });

    test.each([
      ['a frontmatter change', pages.map((page, index) => (index === 0 ? { ...page, frontmatter: { title: 'Home, edited' } } : page))],
      ['a page added', [...pages, makePage({ sourcePath: 'about.tpl', outputPath: 'about/index.html', url: '/about/' })]],
      ['a page removed', pages.slice(0, 1)],
    ])('%s reruns every hook, and the version differs from the earlier run', async (_case, changed) => {
      const listing = vi.fn<PageHook>(() => ({ pages: [] }));
      const tags = vi.fn<PageHook>(() => ({ tags: [] }));
      const records = fresh();
      const first = await runPageHooks(pages, [hook('listing', listing), hook('tags', tags)], records);
      const second = await runPageHooks(changed, [hook('listing', listing), hook('tags', tags)], records);
      expect(listing).toHaveBeenCalledTimes(2);
      expect(tags).toHaveBeenCalledTimes(2);
      expect(versionsOf(second)[0]).not.toBe(versionsOf(first)[0]);
    });
  });
});
