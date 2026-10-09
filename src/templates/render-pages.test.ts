// spec: docs/specs/templates.md

import { hash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { beforeEach, describe, expect, vi } from 'vitest';
import { makeFileEntry } from '../../test/helpers/make-file-entry.ts';
import { makePage } from '../../test/helpers/make-page.ts';
import { makeReporter } from '../../test/helpers/make-reporter.ts';
import { makeTemplate } from '../../test/helpers/make-template.ts';
import { test } from '../../test/helpers/test.ts';
import type { Versions } from '../build/bind-build.ts';
import type { UnitRecords } from '../build/reuse-unit.ts';
import { PluginError } from '../plugins/bind-render-context.ts';
import type { MakeRenderContext } from '../plugins/bind-render-context.ts';
import type { RegisteredRenderer, Renderer } from '../plugins/register-plugins.ts';
import { renderPages } from './render-pages.ts';
import type { RenderedBody, RenderedPage, RenderedPages } from './render-pages.ts';
import type { PageChain } from './resolve-chains.ts';

// A rendered page as renderPages reports it.
const rendered = (sourcePath: string, outputPath: string, contents: string) => ({ sourcePath, outputPath, contents, hash: hash('sha256', contents, 'hex'), emits: [] });

const fakeRenderer = (): ReturnType<typeof vi.fn<Renderer>> => vi.fn<Renderer>((_body, { sourcePath }) => `rendered ${sourcePath}`);

// Where the stub context and the renders report, cleared before each test.
const reporter = makeReporter();

beforeEach(() => {
  for (const method of Object.values(reporter)) {
    vi.mocked(method).mockClear();
  }
});

// A context of the file's fields alone, observing a variable read and a body
// read, pushing an emit as the file's own, and reporting a warning under its
// attribution, with the other operations doing nothing.
const makeContext: MakeRenderContext = (sourcePath, variables, bodies, observe, emits, attribution) => ({
  sourcePath,
  variables: new Proxy(variables, {
    get: (target, key): unknown => {
      if (typeof key === 'string') {
        observe('global', key);
      }
      return Reflect.get(target, key);
    },
  }),
  readFile: () => undefined,
  readOutput: () => undefined,
  readBody: (url) => {
    observe('body', url);
    return bodies?.get(url) ?? '';
  },
  enterFile: (reference, entered) => makeContext(reference, entered, bodies, observe, emits, attribution),
  emit: (outputPath, _parameters, produce) => {
    emits.push({ pluginName: 'fixture', sourcePath, outputPath, parametersHash: '', produce });
  },
  warn: (message) => {
    reporter.warned(attribution.unit, attribution.pluginName, message);
  },
});

const freshVersions = (overrides: Partial<Versions> = {}): Versions =>
  ({ files: new Map(), outputs: new Map(), globals: new Map(), allGlobals: '', chains: new Map(), bodies: new Map(), ...overrides });

// Records no earlier run filled.
const freshRecords = (): { bodies: UnitRecords<RenderedBody>; pages: UnitRecords<RenderedPage> } => ({ bodies: new Map(), pages: new Map() });

const renderEverything = (pageChains: PageChain[], globals: Record<string, unknown> = {}, versions = freshVersions(), records = freshRecords()): Promise<RenderedPages> =>
  renderPages(pageChains, globals, makeContext, versions, records.bodies, records.pages, reporter);

// The pages alone.
const renderAll = async (...args: Parameters<typeof renderEverything>): Promise<RenderedPage[]> => (await renderEverything(...args)).pages;

// The file table entries for the files named, each hashed as its own path.
const hashed = (...sourcePaths: string[]): Versions['files'] => new Map(sourcePaths.map((sourcePath) => [sourcePath, makeFileEntry(sourcePath)]));

describe('renderPages', () => {
  test("the page renders with its variables, then the template with the page's output as _content", async () => {
    const render = fakeRenderer();
    const page = makePage({ sourcePath: 'index.tpl', renderer: { pluginName: 'fixture', render }, frontmatter: { title: 'Home' }, body: 'The home page.' });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render }, body: 'The root template.' });
    await expect(renderAll([{ page, chain: [root] }], {})).resolves.toStrictEqual([rendered('index.tpl', 'index.html', 'rendered _.tpl')]);
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
    const page = makePage({ sourcePath: 'index.tpl', renderer: { pluginName: 'fixture', render }, frontmatter: { title: 'Page' } });
    const near = makeTemplate({ sourcePath: '_near.tpl', renderer: { pluginName: 'fixture', render }, name: '_near', frontmatter: { title: 'Near', color: 'blue', near: true } });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render }, frontmatter: { title: 'Root', color: 'red', root: true } });
    await renderAll([{ page, chain: [near, root] }], {});
    const merged = { title: 'Page', color: 'blue', near: true, root: true, _url: '/' };
    for (const [, context] of render.mock.calls) {
      expect(context.variables).toMatchObject(merged);
    }
  });

  test('the globals sit beneath the templates and the page, and every file sees the ones nothing overrides', async () => {
    const render = fakeRenderer();
    const page = makePage({ sourcePath: 'index.tpl', renderer: { pluginName: 'fixture', render }, frontmatter: { title: 'Page' } });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render }, frontmatter: { color: 'Root' } });
    await renderAll([{ page, chain: [root] }], { title: 'Global', color: 'Global', siteName: 'Site' });
    expect(render.mock.calls.map(([, { variables }]) => variables)).toStrictEqual([
      { title: 'Page', color: 'Root', siteName: 'Site', _url: '/', _chain: [] },
      { title: 'Page', color: 'Root', siteName: 'Site', _url: '/', _content: 'rendered index.tpl', _chain: [{ title: 'Page' }] },
    ]);
  });

  test('_chain holds the frontmatter of each file below, nearest first, and is empty in the page', async () => {
    const render = fakeRenderer();
    const page = makePage({ sourcePath: 'index.tpl', renderer: { pluginName: 'fixture', render }, frontmatter: { title: 'Page' } });
    const near = makeTemplate({ sourcePath: '_near.tpl', renderer: { pluginName: 'fixture', render }, name: '_near', frontmatter: { layout: 'near' } });
    const middle = makeTemplate({ sourcePath: '_middle.tpl', renderer: { pluginName: 'fixture', render }, name: '_middle', frontmatter: { layout: 'middle' } });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render }, frontmatter: { layout: 'root' } });
    await renderAll([{ page, chain: [near, middle, root] }], {});
    expect(render.mock.calls.map(([, { variables }]) => variables._chain)).toStrictEqual([
      [],
      [{ title: 'Page' }],
      [{ layout: 'near' }, { title: 'Page' }],
      [{ layout: 'middle' }, { layout: 'near' }, { title: 'Page' }],
    ]);
  });

  test("_url is the page's URL in every file of the chain", async () => {
    const render = fakeRenderer();
    const page = makePage({ sourcePath: 'blog/hello.tpl', renderer: { pluginName: 'fixture', render }, outputPath: 'blog/hello/index.html', url: '/blog/hello/' });
    const post = makeTemplate({ sourcePath: 'blog/_post.tpl', renderer: { pluginName: 'fixture', render }, name: '_post' });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render } });
    await renderAll([{ page, chain: [post, root] }], {});
    expect(render.mock.calls.map(([, { variables }]) => variables._url)).toStrictEqual(['/blog/hello/', '/blog/hello/', '/blog/hello/']);
  });

  test('each file renders with its own renderer', async () => {
    const renderMarkdown = vi.fn<Renderer>(() => 'from markdown');
    const renderTemplate = vi.fn<Renderer>((_body, { variables }) => `wrapped ${String(variables._content)}`);
    const page = makePage({ sourcePath: 'index.md', extension: 'md', renderer: { pluginName: 'fixture', render: renderMarkdown }, body: '# Home' });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render: renderTemplate } });
    await expect(renderAll([{ page, chain: [root] }], {})).resolves.toStrictEqual([rendered('index.md', 'index.html', 'wrapped from markdown')]);
    expect(renderMarkdown).toHaveBeenCalledExactlyOnceWith('# Home', expect.objectContaining({ sourcePath: 'index.md' }));
    expect(renderTemplate).toHaveBeenCalledTimes(1);
  });

  test("an asynchronous renderer's promise is awaited", async () => {
    const render = vi.fn<Renderer>(async (_body, { sourcePath }) => {
      await setTimeout(1);
      return `rendered ${sourcePath}`;
    });
    const page = makePage({ sourcePath: 'index.tpl', renderer: { pluginName: 'fixture', render } });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render } });
    await expect(renderAll([{ page, chain: [root] }], {})).resolves.toStrictEqual([rendered('index.tpl', 'index.html', 'rendered _.tpl')]);
  });

  test('pages come back in their order whichever settles first', async () => {
    const slow = vi.fn<Renderer>(async (_body, { sourcePath }) => {
      await setTimeout(20);
      return `slow ${sourcePath}`;
    });
    const fast = vi.fn<Renderer>((_body, { sourcePath }) => `fast ${sourcePath}`);
    const first = makePage({ sourcePath: 'a.tpl', renderer: { pluginName: 'fixture', render: slow }, outputPath: 'a/index.html' });
    const second = makePage({ sourcePath: 'b.tpl', renderer: { pluginName: 'fixture', render: fast }, outputPath: 'b/index.html' });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render: (_body, { variables }) => String(variables._content) } });
    await expect(renderAll([{ page: first, chain: [root] }, { page: second, chain: [root] }], {})).resolves.toStrictEqual([
      rendered('a.tpl', 'a/index.html', 'slow a.tpl'),
      rendered('b.tpl', 'b/index.html', 'fast b.tpl'),
    ]);
  });

  test('every body renders before any template', async () => {
    const calls: string[] = [];
    const render: Renderer = (_body, { sourcePath }) => {
      calls.push(sourcePath);
      return sourcePath;
    };
    const first = makePage({ sourcePath: 'a.tpl', renderer: { pluginName: 'fixture', render }, outputPath: 'a/index.html' });
    const second = makePage({ sourcePath: 'b.tpl', renderer: { pluginName: 'fixture', render }, outputPath: 'b/index.html' });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render } });
    await renderAll([{ page: first, chain: [root] }, { page: second, chain: [root] }], {});
    expect(calls).toStrictEqual(['a.tpl', 'b.tpl', '_.tpl', '_.tpl']);
  });

  // spec: docs/specs/plugins.md, Render context
  test('every body renders with no bodies to read', async () => {
    const maker = vi.fn<MakeRenderContext>(makeContext);
    const first = makePage({ sourcePath: 'a.tpl', renderer: { pluginName: 'fixture', render: fakeRenderer() }, outputPath: 'a/index.html', url: '/a/' });
    const second = makePage({ sourcePath: 'b.tpl', renderer: { pluginName: 'fixture', render: fakeRenderer() }, outputPath: 'b/index.html', url: '/b/' });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render: fakeRenderer() } });
    await renderPages([{ page: first, chain: [root] }, { page: second, chain: [root] }], {}, maker, freshVersions(), new Map(), new Map(), reporter);
    expect(maker.mock.calls.slice(0, 2).map(([sourcePath, , bodies]) => [sourcePath, bodies])).toStrictEqual([['a.tpl', undefined], ['b.tpl', undefined]]);
  });

  // spec: docs/specs/plugins.md, Render context
  test("every template renders with every page's body under its URL", async () => {
    const maker = vi.fn<MakeRenderContext>(makeContext);
    const first = makePage({ sourcePath: 'a.tpl', renderer: { pluginName: 'fixture', render: fakeRenderer() }, outputPath: 'a/index.html', url: '/a/' });
    const second = makePage({ sourcePath: 'b.tpl', renderer: { pluginName: 'fixture', render: fakeRenderer() }, outputPath: 'b/index.html', url: '/b/' });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render: fakeRenderer() } });
    await renderPages([{ page: first, chain: [root] }, { page: second, chain: [root] }], {}, maker, freshVersions(), new Map(), new Map(), reporter);
    const bodies = new Map([['/a/', 'rendered a.tpl'], ['/b/', 'rendered b.tpl']]);
    expect(maker.mock.calls.slice(2).map(([sourcePath, , pageBodies]) => [sourcePath, pageBodies])).toStrictEqual([['_.tpl', bodies], ['_.tpl', bodies]]);
  });

  // spec: docs/specs/plugins.md, Emitted files
  describe('emits', () => {
    const produce = (): Promise<string> => Promise.resolve('derived');
    // A renderer that emits one file named after the file rendering.
    const emitting = (): RegisteredRenderer => ({
      pluginName: 'fixture',
      render: vi.fn<Renderer>((_body, context) => {
        context.emit(`${context.sourcePath}.derived`, {}, produce);
        return `rendered ${context.sourcePath}`;
      }),
    });
    const emitted = (sourcePath: string) => ({ pluginName: 'fixture', sourcePath, outputPath: `${sourcePath}.derived`, parametersHash: '', produce });

    test("a body's emits and a chain's come back on the result, the bodies' first, and the page carries its chain's alone", async () => {
      const page = makePage({ sourcePath: 'index.tpl', renderer: emitting() });
      const root = makeTemplate({ sourcePath: '_.tpl', renderer: emitting() });
      const { pages, emits } = await renderEverything([{ page, chain: [root] }]);
      expect(emits).toStrictEqual([emitted('index.tpl'), emitted('_.tpl')]);
      expect(pages[0]?.emits).toStrictEqual([emitted('_.tpl')]);
    });

    // spec: docs/specs/build.md, Incremental builds
    test("a reused body's and chain's emits come back on the second call without a render", async () => {
      const renderer = emitting();
      const page = makePage({ sourcePath: 'index.tpl', renderer });
      const root = makeTemplate({ sourcePath: '_.tpl', renderer });
      const versions = freshVersions({ files: hashed('index.tpl', '_.tpl') });
      const records = freshRecords();
      await renderEverything([{ page, chain: [root] }], {}, versions, records);
      vi.mocked(renderer.render).mockClear();
      const { emits } = await renderEverything([{ page, chain: [root] }], {}, versions, records);
      expect(renderer.render).not.toHaveBeenCalled();
      expect(emits).toStrictEqual([emitted('index.tpl'), emitted('_.tpl')]);
    });

    // spec: docs/specs/build.md, Incremental builds
    test('a page left out of the second call contributes no emits, though its records stand', async () => {
      const renderer = emitting();
      const first = makePage({ sourcePath: 'a.tpl', renderer, outputPath: 'a/index.html', url: '/a/' });
      const second = makePage({ sourcePath: 'b.tpl', renderer, outputPath: 'b/index.html', url: '/b/' });
      const versions = freshVersions({ files: hashed('a.tpl', 'b.tpl') });
      const records = freshRecords();
      await renderEverything([{ page: first, chain: [] }, { page: second, chain: [] }], {}, versions, records);
      const { emits } = await renderEverything([{ page: first, chain: [] }], {}, versions, records);
      expect(emits).toStrictEqual([emitted('a.tpl')]);
      expect([...records.bodies.keys()]).toStrictEqual(['a.tpl', 'b.tpl']);
    });
  });

  // spec: docs/specs/plugins.md, Errors
  describe('a warning while rendering', () => {
    const warning = (pluginName: string): RegisteredRenderer => ({
      pluginName,
      render: (body, context) => {
        context.warn('Deprecated.');
        return body;
      },
    });

    test("a warning names the file rendering and its renderer's plugin, in the page and in its template", async () => {
      const page = makePage({ sourcePath: 'index.tpl', renderer: warning('markdown') });
      const root = makeTemplate({ sourcePath: '_.tpl', renderer: warning('ejs') });
      await renderAll([{ page, chain: [root] }], {});
      expect(vi.mocked(reporter.warned).mock.calls).toStrictEqual([
        ['Rendering index.tpl', 'markdown', 'Deprecated.'],
        ['Rendering _.tpl', 'ejs', 'Deprecated.'],
      ]);
    });

    // spec: docs/specs/build.md, Incremental builds
    test('a reused render warns nothing', async () => {
      const page = makePage({ sourcePath: 'index.tpl', renderer: warning('markdown') });
      const root = makeTemplate({ sourcePath: '_.tpl', renderer: warning('ejs') });
      const versions = freshVersions({ files: hashed('index.tpl', '_.tpl') });
      const records = freshRecords();
      await renderAll([{ page, chain: [root] }], {}, versions, records);
      await renderAll([{ page, chain: [root] }], {}, versions, records);
      expect(reporter.warned).toHaveBeenCalledTimes(2);
    });
  });

  // spec: docs/specs/plugins.md, Errors
  describe('a throw while rendering', () => {
    const throwing = (error: unknown): RegisteredRenderer => ({ pluginName: 'fixture', render: () => { throw error; } });

    test("a renderer's throw is reported as the page's render failing in the renderer's plugin, with the throw as cause", async () => {
      const cause = new Error('unexpected token');
      const page = makePage({ sourcePath: 'index.tpl', renderer: throwing(cause) });
      const root = makeTemplate({ sourcePath: '_.tpl' });
      const rendering = renderAll([{ page, chain: [root] }], {});
      await expect(rendering).rejects.toThrow(new Error('Rendering index.tpl failed in fixture: unexpected token'));
      await expect(rendering).rejects.toHaveProperty('cause', cause);
    });

    test('a throw while a template renders names that template', async () => {
      const page = makePage({ sourcePath: 'index.tpl' });
      const root = makeTemplate({ sourcePath: '_.tpl', renderer: throwing(new Error('unexpected token')) });
      await expect(renderAll([{ page, chain: [root] }], {})).rejects.toThrow(new Error('Rendering _.tpl failed in fixture: unexpected token'));
    });

    test("a throw a helper tagged names the helper's plugin", async () => {
      const page = makePage({ sourcePath: 'index.tpl', renderer: throwing(new PluginError('tools', new Error('boom'))) });
      const root = makeTemplate({ sourcePath: '_.tpl' });
      await expect(renderAll([{ page, chain: [root] }], {})).rejects.toThrow(new Error('Rendering index.tpl failed in tools: boom'));
    });
  });

  // spec: docs/specs/build.md, Incremental builds
  describe('across two calls with one set of records', () => {
    test('unchanged versions render nothing the second time, and the pages come back the same', async () => {
      const render = fakeRenderer();
      const page = makePage({ sourcePath: 'index.tpl', renderer: { pluginName: 'fixture', render } });
      const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render } });
      const versions = freshVersions({ files: hashed('index.tpl', '_.tpl') });
      const records = freshRecords();
      const first = await renderAll([{ page, chain: [root] }], {}, versions, records);
      const second = await renderAll([{ page, chain: [root] }], {}, versions, records);
      expect(render).toHaveBeenCalledTimes(2);
      expect(second).toStrictEqual(first);
      expect(versions.chains).toStrictEqual(new Map([['index.tpl', '_.tpl']]));
      expect(versions.bodies).toStrictEqual(new Map([['/', expect.stringMatching(/^[0-9a-f]{64}$/)]]));
    });

    test("a template's hash change renders every body and chain of the pages it wraps, and no other page", async () => {
      const render = fakeRenderer();
      const first = makePage({ sourcePath: 'a.tpl', renderer: { pluginName: 'fixture', render }, outputPath: 'a/index.html', url: '/a/' });
      const second = makePage({ sourcePath: 'b.tpl', renderer: { pluginName: 'fixture', render }, outputPath: 'b/index.html', url: '/b/' });
      const other = makePage({ sourcePath: 'c.tpl', renderer: { pluginName: 'fixture', render }, outputPath: 'c/index.html', url: '/c/' });
      const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render } });
      const wide = makeTemplate({ sourcePath: '_wide.tpl', renderer: { pluginName: 'fixture', render }, name: '_wide' });
      const chains = [{ page: first, chain: [root] }, { page: second, chain: [root] }, { page: other, chain: [wide] }];
      const records = freshRecords();
      await renderAll(chains, {}, freshVersions({ files: hashed('a.tpl', 'b.tpl', 'c.tpl', '_.tpl', '_wide.tpl') }), records);
      render.mockClear();
      await renderAll(chains, {}, freshVersions({ files: new Map([...hashed('a.tpl', 'b.tpl', 'c.tpl', '_wide.tpl'), ['_.tpl', makeFileEntry('edited')]]) }), records);
      expect(render.mock.calls.map(([, { sourcePath }]) => sourcePath)).toStrictEqual(['a.tpl', 'b.tpl', '_.tpl', '_.tpl']);
    });

    test('a chain change renders its page, body and chain', async () => {
      const render = fakeRenderer();
      const page = makePage({ sourcePath: 'index.tpl', renderer: { pluginName: 'fixture', render } });
      const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render } });
      const near = makeTemplate({ sourcePath: '_near.tpl', renderer: { pluginName: 'fixture', render }, name: '_near' });
      const versions = freshVersions({ files: hashed('index.tpl', '_.tpl', '_near.tpl') });
      const records = freshRecords();
      await renderAll([{ page, chain: [root] }], {}, versions, records);
      render.mockClear();
      await renderAll([{ page, chain: [near, root] }], {}, versions, records);
      expect(render.mock.calls.map(([, { sourcePath }]) => sourcePath)).toStrictEqual(['index.tpl', '_near.tpl', '_.tpl']);
      expect(versions.chains.get('index.tpl')).toBe('_near.tpl\n_.tpl');
    });

    test("a body's hash change renders the chains that read it and not their bodies", async () => {
      const renderPage = fakeRenderer();
      let text = 'first';
      const renderChanging = vi.fn<Renderer>(() => text);
      const renderRoot = vi.fn<Renderer>((_body, context) => `root ${context.readBody('/b/')}`);
      const first = makePage({ sourcePath: 'a.tpl', renderer: { pluginName: 'fixture', render: renderPage }, outputPath: 'a/index.html', url: '/a/' });
      const second = makePage({ sourcePath: 'b.tpl', renderer: { pluginName: 'fixture', render: renderChanging }, outputPath: 'b/index.html', url: '/b/' });
      const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render: renderRoot } });
      const chains = [{ page: first, chain: [root] }, { page: second, chain: [root] }];
      const records = freshRecords();
      await renderAll(chains, {}, freshVersions({ files: hashed('a.tpl', 'b.tpl', '_.tpl') }), records);
      text = 'second';
      renderPage.mockClear();
      renderRoot.mockClear();
      const pages = await renderAll(chains, {}, freshVersions({ files: new Map([...hashed('a.tpl', '_.tpl'), ['b.tpl', makeFileEntry('edited')]]) }), records);
      expect(renderPage).not.toHaveBeenCalled();
      expect(renderChanging).toHaveBeenCalledTimes(2);
      expect(renderRoot).toHaveBeenCalledTimes(2);
      expect(pages.map(({ contents }) => contents)).toStrictEqual(['root second', 'root second']);
    });

    test("a global's version change renders the bodies that observed it, and a chain whose body came out the same is reused", async () => {
      const renderReading = vi.fn<Renderer>((_body, { variables }) => `title ${String(variables.title)}`);
      const renderBlind = fakeRenderer();
      const renderRoot = fakeRenderer();
      const first = makePage({ sourcePath: 'a.tpl', renderer: { pluginName: 'fixture', render: renderReading }, outputPath: 'a/index.html', url: '/a/' });
      const second = makePage({ sourcePath: 'b.tpl', renderer: { pluginName: 'fixture', render: renderBlind }, outputPath: 'b/index.html', url: '/b/' });
      const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render: renderRoot } });
      const chains = [{ page: first, chain: [root] }, { page: second, chain: [root] }];
      const records = freshRecords();
      const files = hashed('a.tpl', 'b.tpl', '_.tpl');
      await renderAll(chains, { title: 'Site' }, freshVersions({ files, globals: new Map([['title', 'v1']]) }), records);
      renderReading.mockClear();
      renderBlind.mockClear();
      renderRoot.mockClear();
      await renderAll(chains, { title: 'Site' }, freshVersions({ files, globals: new Map([['title', 'v2']]) }), records);
      expect(renderReading).toHaveBeenCalledTimes(1);
      expect(renderBlind).not.toHaveBeenCalled();
      expect(renderRoot).not.toHaveBeenCalled();
    });
  });

  // spec: docs/specs/build.md, Output
  test("a page's body render and its chain render report their labels", async () => {
    const page = makePage({ sourcePath: 'index.tpl', renderer: { pluginName: 'fixture', render: fakeRenderer() } });
    const root = makeTemplate({ sourcePath: '_.tpl', renderer: { pluginName: 'fixture', render: fakeRenderer() } });
    await renderAll([{ page, chain: [root] }], {});
    expect(vi.mocked(reporter.ran).mock.calls).toStrictEqual([
      ['Rendered the body of index.tpl', []],
      ['Rendered index.tpl', []],
    ]);
  });
});
