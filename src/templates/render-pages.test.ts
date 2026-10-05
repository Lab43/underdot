// spec: docs/specs/templates.md

import { setTimeout } from 'node:timers/promises';
import { describe, expect, test, vi } from 'vitest';
import { makePage } from '../../test/helpers/make-page.ts';
import { makeTemplate } from '../../test/helpers/make-template.ts';
import type { MakeRenderContext } from '../plugins/bind-render-context.ts';
import type { Renderer } from '../plugins/register-plugins.ts';
import { renderPages } from './render-pages.ts';

const fakeRenderer = (): ReturnType<typeof vi.fn<Renderer>> => vi.fn<Renderer>((_body, { sourcePath }) => `rendered ${sourcePath}`);

// A context of the file's fields alone, with operations that do nothing.
const makeContext: MakeRenderContext = (sourcePath, variables, bodies) => ({
  sourcePath,
  variables,
  readFile: () => undefined,
  readOutput: () => undefined,
  readBody: () => '',
  enterFile: (reference, entered) => makeContext(reference, entered, bodies),
});

describe('renderPages', () => {
  test("the page renders with its variables, then the template with the page's output as _content", async () => {
    const render = fakeRenderer();
    const page = makePage({ sourcePath: 'index.tpl', render, frontmatter: { title: 'Home' }, body: 'The home page.' });
    const root = makeTemplate({ sourcePath: '_.tpl', render, body: 'The root template.' });
    await expect(renderPages([{ page, chain: [root] }], {}, makeContext)).resolves.toStrictEqual([{ sourcePath: 'index.tpl', outputPath: 'index.html', contents: 'rendered _.tpl' }]);
    expect(render).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenNthCalledWith(1, 'The home page.', expect.objectContaining({
      sourcePath: 'index.tpl',
      variables: { title: 'Home', _url: '/', _chain: [] },
    }));
    expect(render).toHaveBeenNthCalledWith(2, 'The root template.', expect.objectContaining({
      sourcePath: '_.tpl',
      variables: { title: 'Home', _url: '/', _content: 'rendered index.tpl', _chain: [{ title: 'Home' }] },
    }));
  });

  test('the page overrides the nearest template, which overrides the root, and every file sees the merged set', async () => {
    const render = fakeRenderer();
    const page = makePage({ sourcePath: 'index.tpl', render, frontmatter: { title: 'Page' } });
    const near = makeTemplate({ sourcePath: '_near.tpl', render, name: '_near', frontmatter: { title: 'Near', color: 'blue', near: true } });
    const root = makeTemplate({ sourcePath: '_.tpl', render, frontmatter: { title: 'Root', color: 'red', root: true } });
    await renderPages([{ page, chain: [near, root] }], {}, makeContext);
    const merged = { title: 'Page', color: 'blue', near: true, root: true, _url: '/' };
    for (const [, context] of render.mock.calls) {
      expect(context.variables).toMatchObject(merged);
    }
  });

  test('the globals sit beneath the templates and the page, and every file sees the ones nothing overrides', async () => {
    const render = fakeRenderer();
    const page = makePage({ sourcePath: 'index.tpl', render, frontmatter: { title: 'Page' } });
    const root = makeTemplate({ sourcePath: '_.tpl', render, frontmatter: { color: 'Root' } });
    await renderPages([{ page, chain: [root] }], { title: 'Global', color: 'Global', siteName: 'Site' }, makeContext);
    expect(render.mock.calls.map(([, { variables }]) => variables)).toStrictEqual([
      { title: 'Page', color: 'Root', siteName: 'Site', _url: '/', _chain: [] },
      { title: 'Page', color: 'Root', siteName: 'Site', _url: '/', _content: 'rendered index.tpl', _chain: [{ title: 'Page' }] },
    ]);
  });

  test('_chain holds the frontmatter of each file below, nearest first, and is empty in the page', async () => {
    const render = fakeRenderer();
    const page = makePage({ sourcePath: 'index.tpl', render, frontmatter: { title: 'Page' } });
    const near = makeTemplate({ sourcePath: '_near.tpl', render, name: '_near', frontmatter: { layout: 'near' } });
    const middle = makeTemplate({ sourcePath: '_middle.tpl', render, name: '_middle', frontmatter: { layout: 'middle' } });
    const root = makeTemplate({ sourcePath: '_.tpl', render, frontmatter: { layout: 'root' } });
    await renderPages([{ page, chain: [near, middle, root] }], {}, makeContext);
    expect(render.mock.calls.map(([, { variables }]) => variables._chain)).toStrictEqual([
      [],
      [{ title: 'Page' }],
      [{ layout: 'near' }, { title: 'Page' }],
      [{ layout: 'middle' }, { layout: 'near' }, { title: 'Page' }],
    ]);
  });

  test("_url is the page's URL in every file of the chain", async () => {
    const render = fakeRenderer();
    const page = makePage({ sourcePath: 'blog/hello.tpl', render, outputPath: 'blog/hello/index.html', url: '/blog/hello/' });
    const post = makeTemplate({ sourcePath: 'blog/_post.tpl', render, name: '_post' });
    const root = makeTemplate({ sourcePath: '_.tpl', render });
    await renderPages([{ page, chain: [post, root] }], {}, makeContext);
    expect(render.mock.calls.map(([, { variables }]) => variables._url)).toStrictEqual(['/blog/hello/', '/blog/hello/', '/blog/hello/']);
  });

  test('each file renders with its own renderer', async () => {
    const renderMarkdown = vi.fn<Renderer>(() => 'from markdown');
    const renderTemplate = vi.fn<Renderer>((_body, { variables }) => `wrapped ${String(variables._content)}`);
    const page = makePage({ sourcePath: 'index.md', extension: 'md', render: renderMarkdown, body: '# Home' });
    const root = makeTemplate({ sourcePath: '_.tpl', render: renderTemplate });
    await expect(renderPages([{ page, chain: [root] }], {}, makeContext)).resolves.toStrictEqual([{ sourcePath: 'index.md', outputPath: 'index.html', contents: 'wrapped from markdown' }]);
    expect(renderMarkdown).toHaveBeenCalledExactlyOnceWith('# Home', expect.objectContaining({ sourcePath: 'index.md' }));
    expect(renderTemplate).toHaveBeenCalledTimes(1);
  });

  test("an asynchronous renderer's promise is awaited", async () => {
    const render = vi.fn<Renderer>(async (_body, { sourcePath }) => {
      await setTimeout(1);
      return `rendered ${sourcePath}`;
    });
    const page = makePage({ sourcePath: 'index.tpl', render });
    const root = makeTemplate({ sourcePath: '_.tpl', render });
    await expect(renderPages([{ page, chain: [root] }], {}, makeContext)).resolves.toStrictEqual([{ sourcePath: 'index.tpl', outputPath: 'index.html', contents: 'rendered _.tpl' }]);
  });

  test('pages come back in their order whichever settles first', async () => {
    const slow = vi.fn<Renderer>(async (_body, { sourcePath }) => {
      await setTimeout(20);
      return `slow ${sourcePath}`;
    });
    const fast = vi.fn<Renderer>((_body, { sourcePath }) => `fast ${sourcePath}`);
    const first = makePage({ sourcePath: 'a.tpl', render: slow, outputPath: 'a/index.html' });
    const second = makePage({ sourcePath: 'b.tpl', render: fast, outputPath: 'b/index.html' });
    const root = makeTemplate({ sourcePath: '_.tpl', render: (_body, { variables }) => String(variables._content) });
    await expect(renderPages([{ page: first, chain: [root] }, { page: second, chain: [root] }], {}, makeContext)).resolves.toStrictEqual([
      { sourcePath: 'a.tpl', outputPath: 'a/index.html', contents: 'slow a.tpl' },
      { sourcePath: 'b.tpl', outputPath: 'b/index.html', contents: 'fast b.tpl' },
    ]);
  });

  test('every body renders before any template', async () => {
    const calls: string[] = [];
    const render: Renderer = (_body, { sourcePath }) => {
      calls.push(sourcePath);
      return sourcePath;
    };
    const first = makePage({ sourcePath: 'a.tpl', render, outputPath: 'a/index.html' });
    const second = makePage({ sourcePath: 'b.tpl', render, outputPath: 'b/index.html' });
    const root = makeTemplate({ sourcePath: '_.tpl', render });
    await renderPages([{ page: first, chain: [root] }, { page: second, chain: [root] }], {}, makeContext);
    expect(calls).toStrictEqual(['a.tpl', 'b.tpl', '_.tpl', '_.tpl']);
  });

  // spec: docs/specs/plugins.md, Render context
  test('every body renders with no bodies to read', async () => {
    const maker = vi.fn<MakeRenderContext>(makeContext);
    const first = makePage({ sourcePath: 'a.tpl', render: fakeRenderer(), outputPath: 'a/index.html', url: '/a/' });
    const second = makePage({ sourcePath: 'b.tpl', render: fakeRenderer(), outputPath: 'b/index.html', url: '/b/' });
    const root = makeTemplate({ sourcePath: '_.tpl', render: fakeRenderer() });
    await renderPages([{ page: first, chain: [root] }, { page: second, chain: [root] }], {}, maker);
    expect(maker.mock.calls.slice(0, 2).map(([sourcePath, , bodies]) => [sourcePath, bodies])).toStrictEqual([['a.tpl', undefined], ['b.tpl', undefined]]);
  });

  // spec: docs/specs/plugins.md, Render context
  test("every template renders with every page's body under its URL", async () => {
    const maker = vi.fn<MakeRenderContext>(makeContext);
    const first = makePage({ sourcePath: 'a.tpl', render: fakeRenderer(), outputPath: 'a/index.html', url: '/a/' });
    const second = makePage({ sourcePath: 'b.tpl', render: fakeRenderer(), outputPath: 'b/index.html', url: '/b/' });
    const root = makeTemplate({ sourcePath: '_.tpl', render: fakeRenderer() });
    await renderPages([{ page: first, chain: [root] }, { page: second, chain: [root] }], {}, maker);
    const bodies = new Map([['/a/', 'rendered a.tpl'], ['/b/', 'rendered b.tpl']]);
    expect(maker.mock.calls.slice(2).map(([sourcePath, , pageBodies]) => [sourcePath, pageBodies])).toStrictEqual([['_.tpl', bodies], ['_.tpl', bodies]]);
  });

  test("a renderer's throw rejects with that error", async () => {
    const error = new Error('unexpected token');
    const page = makePage({ sourcePath: 'index.tpl', render: () => { throw error; } });
    const root = makeTemplate({ sourcePath: '_.tpl' });
    await expect(renderPages([{ page, chain: [root] }], {}, makeContext)).rejects.toBe(error);
  });
});
