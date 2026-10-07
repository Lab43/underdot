// spec: docs/specs/build.md

import { copyFile, readFile, rename, rm, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import bustConfiguration from '../../test/fixtures/bust/underdot.config.ts';
import collectionsConfiguration from '../../test/fixtures/collections/underdot.config.ts';
import defaultsConfiguration from '../../test/fixtures/defaults/underdot.config.ts';
import ejsConfiguration from '../../test/fixtures/ejs/underdot.config.ts';
import excludingConfiguration from '../../test/fixtures/excluding/underdot.config.ts';
import helpersConfiguration from '../../test/fixtures/helpers/underdot.config.ts';
import svgoConfiguration from '../../test/fixtures/svgo/underdot.config.ts';
import templatedConfiguration from '../../test/fixtures/templated/underdot.config.ts';
import { assertAbsent } from '../../test/helpers/assert-absent.ts';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { renderBody } from '../../test/helpers/render-body.ts';
import { test } from '../../test/helpers/test.ts';
import { resolveConfiguration } from '../configuration/resolve-configuration.ts';
import type { Configuration } from '../configuration/resolve-configuration.ts';
import type { RenderContext } from '../plugins/bind-render-context.ts';
import type { FileHandler, Helper, PageHook, Plugin, Renderer } from '../plugins/register-plugins.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { bindBuild } from './bind-build.ts';

vi.mock('node:fs/promises', { spy: true });

const defaultsFixture = fixturePath('defaults');

const defaultsFiles = [
  '.htaccess',
  '.well-known/security.txt',
  'about/index.html',
  'about/team.txt',
  'index.html',
  'styles/site.css',
];

// The walk lists a destination the same way it lists a source.
const list = walkSource;

const contents = async (directory: string, paths: string[]): Promise<string[]> =>
  Promise.all(paths.map((path) => readFile(join(directory, path), 'utf8')));

// A configuration's plugins with every renderer, handler, and page hook
// wrapped in a spy, and every producer a helper emits noting its output path,
// so a build can say which units ran.
interface WrappedPlugins {
  plugins: Plugin[];
  renders: Mock<Renderer>[];
  handles: Mock<FileHandler>[];
  hooks: Mock<PageHook>[];
  produced: string[];
}

const wrapPlugins = (plugins: Plugin[]): WrappedPlugins => {
  const wrapped: WrappedPlugins = { plugins: [], renders: [], handles: [], hooks: [], produced: [] };
  for (const plugin of plugins) {
    const copy: Plugin = { ...plugin };
    if (plugin.renderers !== undefined) {
      copy.renderers = Object.fromEntries(Object.entries(plugin.renderers).map(([extension, render]) => {
        const spy = vi.fn(render);
        wrapped.renders.push(spy);
        return [extension, spy];
      }));
    }
    if (plugin.helpers !== undefined) {
      copy.helpers = Object.fromEntries(Object.entries(plugin.helpers).map(([name, helper]): [string, Helper] => [name, (context, ...args) => {
        const emit: RenderContext['emit'] = (outputPath, parameters, produce) => {
          context.emit(outputPath, parameters, (producerContext) => {
            wrapped.produced.push(outputPath);
            return produce(producerContext);
          });
        };
        return helper({ ...context, emit }, ...args);
      }]));
    }
    if (plugin.handlers !== undefined) {
      copy.handlers = Object.fromEntries(Object.entries(plugin.handlers).map(([glob, handle]) => {
        const spy = vi.fn(handle);
        wrapped.handles.push(spy);
        return [glob, spy];
      }));
    }
    if (plugin.pageHook !== undefined) {
      const spy = vi.fn(plugin.pageHook);
      copy.pageHook = spy;
      wrapped.hooks.push(spy);
    }
    wrapped.plugins.push(copy);
  }
  return wrapped;
};

// What one build did: the output paths the handlers received, how many hooks
// ran, the URLs of the pages whose body and whose chain rendered, the output
// paths produced, and the destination paths written.
interface Ran {
  handled: string[];
  hooks: number;
  bodies: string[];
  chains: string[];
  produced: string[];
  written: string[];
}

const unique = (items: string[]): string[] => [...new Set(items)].sort();

// Bind the fixture's configuration twice: once with wrapped plugins and a
// memory shared by every build, and once per build with the fixture's own
// plugins into `fresh`, the full build each rebuild is held to.
const bindCatalogue = (configuration: Configuration, directory: string) => {
  const wrapped = wrapPlugins(configuration.plugins ?? []);
  const build = bindBuild(resolveConfiguration({ ...configuration, plugins: wrapped.plugins }, directory));
  const source = join(directory, 'source');
  const destination = join(directory, 'build');
  const fresh = join(directory, 'fresh');
  const edit = (sourcePath: string, text: string): Promise<void> => writeFile(join(source, sourcePath), text);
  const rebuild = async (): Promise<Ran> => {
    for (const spy of [...wrapped.renders, ...wrapped.handles, ...wrapped.hooks, vi.mocked(writeFile), vi.mocked(copyFile)]) {
      spy.mockClear();
    }
    wrapped.produced.length = 0;
    await build();
    const renders = wrapped.renders.flatMap((render) => render.mock.calls.map(([, context]) => context));
    const isTemplate = (sourcePath: string): boolean => sourcePath.split('/').some((segment) => segment.startsWith('_'));
    const urlOf = (context: { variables: Record<string, unknown> }): string => String(context.variables._url);
    const targets = [...vi.mocked(writeFile).mock.calls.map(([target]) => target), ...vi.mocked(copyFile).mock.calls.map(([, target]) => target)];
    const ran: Ran = {
      handled: wrapped.handles.flatMap((handle) => handle.mock.calls.map(([file]) => file.outputPath)).sort(),
      hooks: wrapped.hooks.reduce((count, hook) => count + hook.mock.calls.length, 0),
      bodies: unique(renders.filter(({ sourcePath }) => !isTemplate(sourcePath)).map(urlOf)),
      chains: unique(renders.filter(({ sourcePath }) => isTemplate(sourcePath)).map(urlOf)),
      produced: wrapped.produced.toSorted(),
      written: targets.map(String).filter((target) => target.startsWith(`${destination}/`)).map((target) => target.slice(destination.length + 1)).sort(),
    };
    await bindBuild(resolveConfiguration({ ...configuration, destination: 'fresh' }, directory))();
    const paths = await list(destination);
    expect(paths).toStrictEqual(await list(fresh));
    for (const path of paths) {
      expect(await readFile(join(destination, path))).toStrictEqual(await readFile(join(fresh, path)));
    }
    return ran;
  };
  return { build, source, destination, edit, rebuild };
};

// The home page of the templated fixture with its title and body replaced.
const homePage = (title: string, body: string): string => `---\ntitle: ${title}\ndate: 2024-01-02\n---\n${body}\n`;

// A post added to the templated fixture's blog.
const secondPost = '---\ntitle: Second\n---\nThe second post.\n';

// Every page of the templated fixture, by URL and by destination path.
const everyPage = ['/', '/404.html', '/about/', '/about/team/', '/blog/', '/blog/hello/', '/pages/'];
const everyPageFile = ['404.html', 'about/index.html', 'about/team/index.html', 'blog/hello/index.html', 'blog/index.html', 'index.html', 'pages/index.html'];

// What a build did, with nothing rerun unless said.
const ran = (fields: Partial<Ran> = {}): Ran => ({ handled: [], hooks: 0, bodies: [], chains: [], produced: [], written: [], ...fields });

describe('bindBuild', () => {
  test('the defaults fixture builds its static files, each byte-equal to its source', async ({ directory }) => {
    const destination = join(directory, 'build');
    await bindBuild(resolveConfiguration(defaultsConfiguration, directory))();
    expect(await list(destination)).toStrictEqual(defaultsFiles);
    expect(await contents(destination, defaultsFiles)).toStrictEqual(await contents(join(directory, 'source'), defaultsFiles));
    await assertAbsent(join(destination, 'litter'));
  });

  test('building twice produces the same destination', async ({ directory }) => {
    const destination = join(directory, 'build');
    const configuration = resolveConfiguration(defaultsConfiguration, directory);
    await bindBuild(configuration)();
    const first = await contents(destination, defaultsFiles);
    await bindBuild(configuration)();
    expect(await list(destination)).toStrictEqual(defaultsFiles);
    expect(await contents(destination, defaultsFiles)).toStrictEqual(first);
  });

  describe('the excluding fixture', () => {
    test.override({ fixture: 'excluding' });

    test('builds only what its patterns keep', async ({ directory }) => {
      await bindBuild(resolveConfiguration(excludingConfiguration, directory))();
      expect(await list(join(directory, 'build'))).toStrictEqual(['.DS_Store', 'index.html']);
    });
  });

  describe('the templated fixture', () => {
    test.override({ fixture: 'templated' });

    // spec: docs/specs/plugins.md, Render context
    test('builds every page through its chain beside its static files, file for file as expected', async ({ directory }) => {
      const destination = join(directory, 'build');
      const expected = fixturePath('templated', 'expected');
      await bindBuild(resolveConfiguration(templatedConfiguration, directory))();
      const paths = await list(destination);
      expect(paths).toStrictEqual(await list(expected));
      for (const path of paths) {
        await expect(await readFile(join(destination, path), 'utf8')).toMatchFileSnapshot(join(expected, path));
      }
    });

    // spec: docs/specs/build.md, Incremental builds
    // spec: docs/specs/build.md, Determinism
    test('a bound build run again reruns only the units whose inputs changed, and its destination equals a fresh build after every change', async ({ directory }) => {
      const { build, source, destination, edit, rebuild } = bindCatalogue(templatedConfiguration, directory);
      await build();

      // 1. No change.
      expect(await rebuild()).toStrictEqual(ran());

      // 2. Edit the home page's body to read a global nothing defines.
      await edit('index.tpl', homePage('Home', 'The home page: date {{ date }}, tagline {{ tagline }}.'));
      expect(await rebuild()).toStrictEqual(ran({ bodies: ['/'], chains: ['/'], written: ['index.html'] }));

      // 3. Define that global with a data file.
      await edit('_data/tagline.json', '"Make it so"\n');
      expect(await rebuild()).toStrictEqual(ran({ bodies: ['/'], chains: ['/'], written: ['index.html'] }));
      expect(await readFile(join(destination, 'index.html'), 'utf8')).toContain('tagline Make it so');

      // 4. Edit the home page's title, which the hook sees.
      await edit('index.tpl', homePage('Home, edited', 'The home page: date {{ date }}, tagline {{ tagline }}.'));
      expect(await rebuild()).toStrictEqual(ran({ hooks: 1, bodies: ['/', '/pages/'], chains: ['/', '/pages/'], written: ['index.html', 'pages/index.html'] }));

      // 5. Edit the root template.
      await edit('_.tpl', `${await readFile(join(source, '_.tpl'), 'utf8')}The root template, edited.\n`);
      expect(await rebuild()).toStrictEqual(ran({ bodies: everyPage, chains: everyPage, written: everyPageFile }));

      // 6. Add a nearer template for the team page, then remove it.
      await edit('about/_page.tpl', 'The about page template: title {{ title }}.\n{{ _content }}\n');
      expect(await rebuild()).toStrictEqual(ran({ bodies: ['/about/team/'], chains: ['/about/team/'], written: ['about/team/index.html'] }));
      await rm(join(source, 'about/_page.tpl'));
      expect(await rebuild()).toStrictEqual(ran({ bodies: ['/about/team/'], chains: ['/about/team/'], written: ['about/team/index.html'] }));

      // 7. Edit the private partial the root template reads, as a file and as an output.
      await edit('_partial.txt', 'The private partial, edited.\n');
      expect(await rebuild()).toStrictEqual(ran({ handled: ['_partial.text', '_partial.txt'], chains: everyPage, written: everyPageFile }));

      // 8. Add the file the about page reads and found absent.
      await edit('missing.txt', 'The found file.\n');
      expect(await rebuild()).toStrictEqual(ran({ handled: ['missing.text', 'missing.txt'], bodies: ['/about/'], chains: ['/about/'], written: ['about/index.html', 'missing.text'] }));

      // 9. Edit the notes file, whose output the blog template reads and the
      // derived files' producers read, though no render that emits them does.
      await edit('notes.txt', 'The notes file, edited.\n');
      expect(await rebuild()).toStrictEqual(ran({
        handled: ['notes.derived.text', 'notes.text', 'notes.txt'],
        chains: ['/blog/', '/blog/hello/'],
        produced: ['notes.derived.text', 'notes.derived.txt'],
        written: ['blog/hello/index.html', 'blog/index.html', 'notes.derived.text', 'notes.derived.txt', 'notes.text'],
      }));

      // 10. Edit the body of the post the archive template reads.
      await edit('blog/hello.tpl', '---\ntemplate: post\ntitle: Hello\n---\nThe hello post: layout {{ layout }}, edited.\n');
      expect(await rebuild()).toStrictEqual(ran({ bodies: ['/blog/hello/'], chains: ['/blog/', '/blog/hello/'], written: ['blog/hello/index.html', 'blog/index.html'] }));

      // 11. Add a post.
      await edit('blog/second.tpl', secondPost);
      expect(await rebuild()).toStrictEqual(ran({ hooks: 1, bodies: ['/blog/second/', '/pages/'], chains: ['/blog/second/', '/pages/'], written: ['blog/second/index.html', 'pages/index.html'] }));

      // 12. Rename the post.
      await rename(join(source, 'blog/second.tpl'), join(source, 'blog/third.tpl'));
      expect(await rebuild()).toStrictEqual(ran({ hooks: 1, bodies: ['/blog/third/', '/pages/'], chains: ['/blog/third/', '/pages/'], written: ['blog/third/index.html', 'pages/index.html'] }));
      await assertAbsent(join(destination, 'blog/second'));

      // 13. Remove the post.
      await rm(join(source, 'blog/third.tpl'));
      expect(await rebuild()).toStrictEqual(ran({ hooks: 1, bodies: ['/pages/'], chains: ['/pages/'], written: ['pages/index.html'] }));
      await assertAbsent(join(destination, 'blog/third'));

      // 14. Edit a data module.
      await edit('_data/team/motto.ts', "export default 'Ship it now';\n");
      expect(await rebuild()).toStrictEqual(ran({ bodies: ['/about/team/'], chains: ['/about/team/'], written: ['about/team/index.html'] }));
      expect(await readFile(join(destination, 'about/team/index.html'), 'utf8')).toContain('motto Ship it now');

      // 15. Edit a file a handler drops.
      await edit('scratch.drop', 'A scratch file no handler keeps, edited.\n');
      expect(await rebuild()).toStrictEqual(ran({ handled: ['scratch.drop'] }));

      // 16. Edit a stylesheet, whose map the handler fixes.
      await edit('styles/site.css', 'body { margin: 0; padding: 0; }\n');
      expect(await rebuild()).toStrictEqual(ran({ handled: ['styles/site.css', 'styles/site.css'], written: ['styles/site.css'] }));

      // 17. Touch a page.
      const now = new Date();
      await utimes(join(source, 'index.tpl'), now, now);
      expect(await rebuild()).toStrictEqual(ran());

      // 18. Remove a derived file from the destination.
      await rm(join(destination, 'notes.derived.txt'));
      expect(await rebuild()).toStrictEqual(ran({ produced: ['notes.derived.txt'], written: ['notes.derived.txt'] }));

      // 19. No change, after the derived file came back.
      expect(await rebuild()).toStrictEqual(ran());
    });
  });

  describe('the ejs fixture', () => {
    test.override({ fixture: 'ejs' });

    // spec: docs/specs/ejs.md
    test('builds every page through EJS, its includes and data among them, file for file as expected', async ({ directory }) => {
      const destination = join(directory, 'build');
      const expected = fixturePath('ejs', 'expected');
      await bindBuild(resolveConfiguration(ejsConfiguration, directory))();
      const paths = await list(destination);
      expect(paths).toStrictEqual(await list(expected));
      for (const path of paths) {
        await expect(await readFile(join(destination, path), 'utf8')).toMatchFileSnapshot(join(expected, path));
      }
    });

    // spec: docs/specs/build.md, Incremental builds
    test('a bound build run again re-renders only the EJS files that read what changed, through the plugin as published', async ({ directory }) => {
      const { build, edit, rebuild } = bindCatalogue(ejsConfiguration, directory);
      await build();

      // Only the home page's body reads `team`.
      await edit('_data/team.json', '{ "leads": ["Ada", "Grace", "Linus"] }\n');
      expect(await rebuild()).toStrictEqual(ran({ bodies: ['/'], chains: ['/'], written: ['index.html'] }));

      // The root template and its footer partial read `site`, and no page body does.
      await edit('_data/site.json', '{ "name": "Example", "year": 2025 }\n');
      expect(await rebuild()).toStrictEqual(ran({ chains: ['/', '/blog/hello/'], written: ['blog/hello/index.html', 'index.html'] }));
    });
  });

  describe('the bust fixture', () => {
    test.override({ fixture: 'bust' });

    // spec: docs/specs/bust.md
    test('busts each link with the hash of the handled output, file for file as expected', async ({ directory }) => {
      const destination = join(directory, 'build');
      const expected = fixturePath('bust', 'expected');
      await bindBuild(resolveConfiguration(bustConfiguration, directory))();
      const paths = await list(destination);
      expect(paths).toStrictEqual(await list(expected));
      for (const path of paths) {
        await expect(await readFile(join(destination, path), 'utf8')).toMatchFileSnapshot(join(expected, path));
      }
    });
  });

  describe('the helpers fixture', () => {
    test.override({ fixture: 'helpers' });

    // spec: docs/specs/helpers.md
    test('marks each link, formats the date, and guards each include on the served output, file for file as expected', async ({ directory }) => {
      const destination = join(directory, 'build');
      const expected = fixturePath('helpers', 'expected');
      await bindBuild(resolveConfiguration(helpersConfiguration, directory))();
      const paths = await list(destination);
      expect(paths).toStrictEqual(await list(expected));
      for (const path of paths) {
        await expect(await readFile(join(destination, path), 'utf8')).toMatchFileSnapshot(join(expected, path));
      }
    });
  });

  describe('the svgo fixture', () => {
    test.override({ fixture: 'svgo' });

    // spec: docs/specs/svgo.md
    test('optimizes every SVG and inlines a private one, file for file as expected', async ({ directory }) => {
      const destination = join(directory, 'build');
      const expected = fixturePath('svgo', 'expected');
      await bindBuild(resolveConfiguration(svgoConfiguration, directory))();
      const paths = await list(destination);
      expect(paths).toStrictEqual(await list(expected));
      for (const path of paths) {
        await expect(await readFile(join(destination, path), 'utf8')).toMatchFileSnapshot(join(expected, path));
      }
    });
  });

  describe('the collections fixture', () => {
    test.override({ fixture: 'collections' });

    // spec: docs/specs/collections.md
    test('lists the posts in source-path order and embeds each body sorted by date, file for file as expected', async ({ directory }) => {
      const destination = join(directory, 'build');
      const expected = fixturePath('collections', 'expected');
      await bindBuild(resolveConfiguration(collectionsConfiguration, directory))();
      const paths = await list(destination);
      expect(paths).toStrictEqual(await list(expected));
      for (const path of paths) {
        await expect(await readFile(join(destination, path), 'utf8')).toMatchFileSnapshot(join(expected, path));
      }
    });

    // spec: docs/specs/build.md, Incremental builds
    test("a bound build run again re-renders a post's body and the chains that read it through the collections helper", async ({ directory }) => {
      const { build, edit, rebuild } = bindCatalogue(collectionsConfiguration, directory);
      await build();
      await edit('posts/hello.ejs', '---\ntitle: Hello\ndate: 2024-01-02\n---\n<p>Hello, world, again.</p>\n');
      expect(await rebuild()).toStrictEqual(ran({ bodies: ['/posts/hello/'], chains: ['/', '/posts/hello/'], written: ['index.html', 'posts/hello/index.html'] }));
    });
  });

  test('a frontmatter error names the page and fails before any write', async () => {
    const directory = fixturePath('bad-frontmatter');
    const plugins = [{ name: 'fixture', renderers: { tpl: renderBody } }];
    await expect(bindBuild(resolveConfiguration({ plugins }, directory))()).rejects.toThrow(
      new Error('index.tpl: The frontmatter key _title starts with an underscore, which is reserved.'),
    );
    await assertAbsent(join(directory, 'build'));
  });

  // spec: docs/specs/plugins.md, Errors
  test("a helper's throw names the template that was rendering and the helper's plugin, and fails before any write", async () => {
    const directory = fixturePath('templated');
    // Only the root template calls the helper, so the report is the same
    // whichever page's chain renders first.
    const plugins: Plugin[] = [
      {
        name: 'fixture',
        renderers: {
          tpl: (body, { sourcePath, variables }) => {
            const { boom } = variables;
            if (sourcePath === '_.tpl' && typeof boom === 'function') {
              boom();
            }
            return body;
          },
        },
      },
      { name: 'tools', helpers: { boom: () => { throw new Error('boom'); } } },
    ];
    await expect(bindBuild(resolveConfiguration({ plugins }, directory))()).rejects.toThrow(new Error('Rendering _.tpl failed in tools: boom'));
    await assertAbsent(join(directory, 'build'));
  });

  // spec: docs/specs/plugins.md, Page hooks
  test("a page hook's throw names the plugin and fails before any write", async () => {
    const directory = fixturePath('templated');
    const plugins: Plugin[] = [
      { name: 'fixture', renderers: { tpl: renderBody } },
      { name: 'listing', pageHook: () => { throw new Error('boom'); } },
    ];
    await expect(bindBuild(resolveConfiguration({ plugins }, directory))()).rejects.toThrow(new Error('Running the page hook failed in listing: boom'));
    await assertAbsent(join(directory, 'build'));
  });

  test('two plugins with one name fail before any write', async () => {
    const configuration = resolveConfiguration({ plugins: [{ name: 'dup' }, { name: 'dup' }] }, defaultsFixture);
    await expect(bindBuild(configuration)()).rejects.toThrow(new Error('Two plugins are named dup.'));
    await assertAbsent(join(defaultsFixture, 'build'));
  });

  test("the walk's error reaches the caller", async () => {
    await expect(bindBuild(resolveConfiguration({ source: 'content' }, defaultsFixture))()).rejects.toThrow(
      new Error(`The source root ${join(defaultsFixture, 'content')} does not exist.`),
    );
  });
});
