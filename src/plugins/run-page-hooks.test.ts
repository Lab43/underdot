// spec: docs/specs/plugins.md, Page hooks

import { setTimeout } from 'node:timers/promises';
import { describe, expect, test, vi } from 'vitest';
import { makePage } from '../../test/helpers/make-page.ts';
import type { PageHook, RegisteredHook } from './register-plugins.ts';
import { runPageHooks } from './run-page-hooks.ts';
import type { HookPage } from './run-page-hooks.ts';

const pages = [
  makePage({ sourcePath: 'index.tpl', frontmatter: { title: 'Home' }, template: undefined, body: 'The home page.' }),
  makePage({ sourcePath: 'blog/hello.tpl', outputPath: 'blog/hello/index.html', url: '/blog/hello/', frontmatter: { title: 'Hello' }, template: 'post', body: 'The hello post.' }),
];

const seen: HookPage[] = [
  { sourcePath: 'index.tpl', outputPath: 'index.html', url: '/', frontmatter: { title: 'Home' } },
  { sourcePath: 'blog/hello.tpl', outputPath: 'blog/hello/index.html', url: '/blog/hello/', frontmatter: { title: 'Hello' } },
];

const hook = (pluginName: string, hook: PageHook): RegisteredHook => ({ pluginName, hook });

describe('runPageHooks', () => {
  test("a hook receives each page's source path, output path, URL, and frontmatter and nothing else, in the pages' order", async () => {
    const listing = vi.fn<PageHook>(() => ({}));
    await runPageHooks(pages, [hook('listing', listing)]);
    expect(listing).toHaveBeenCalledExactlyOnceWith(seen);
  });

  test('two hooks receive the same list', async () => {
    const first = vi.fn<PageHook>(() => ({}));
    const second = vi.fn<PageHook>(() => ({}));
    await runPageHooks(pages, [hook('first', first), hook('second', second)]);
    expect(second.mock.calls[0]?.[0]).toBe(first.mock.calls[0]?.[0]);
  });

  test("the globals come back under their names with each plugin's name, in plugin order", async () => {
    const hooks = [
      hook('listing', (hookPages) => ({ pages: hookPages.map(({ url }) => url), count: hookPages.length })),
      hook('tags', () => ({ tags: ['news'] })),
    ];
    await expect(runPageHooks(pages, hooks)).resolves.toStrictEqual([
      { name: 'pages', pluginName: 'listing', value: ['/', '/blog/hello/'] },
      { name: 'count', pluginName: 'listing', value: 2 },
      { name: 'tags', pluginName: 'tags', value: ['news'] },
    ]);
  });

  test('no hooks define no globals', async () => {
    await expect(runPageHooks(pages, [])).resolves.toStrictEqual([]);
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
    await expect(runPageHooks(pages, [hook('first', slow), hook('second', fast)])).resolves.toStrictEqual([
      { name: 'slow', pluginName: 'first', value: true },
      { name: 'fast', pluginName: 'second', value: true },
    ]);
    expect(calls).toStrictEqual(['slow starts', 'slow settles', 'fast starts']);
  });

  test.each([undefined, null, ['pages'], 'pages'])('a hook returning %j fails naming the plugin', async (returned) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can return
    const forgetful = (() => returned) as unknown as PageHook;
    await expect(runPageHooks(pages, [hook('listing', forgetful)])).rejects.toThrow(new Error('The page hook of listing must return an object of globals.'));
  });

  test('a global starting with an underscore fails naming it and the plugin', async () => {
    await expect(runPageHooks(pages, [hook('listing', () => ({ _pages: [] }))])).rejects.toThrow(
      new Error('The global _pages from the page hook of listing starts with an underscore, which is reserved.'),
    );
  });

  // spec: docs/specs/plugins.md, Errors
  test("a hook's throw is reported as the page hook failing in the plugin, with the throw as cause", async () => {
    const cause = new Error('boom');
    const running = runPageHooks(pages, [hook('listing', () => { throw cause; })]);
    await expect(running).rejects.toThrow(new Error('Running the page hook failed in listing: boom'));
    await expect(running).rejects.toHaveProperty('cause', cause);
  });
});
