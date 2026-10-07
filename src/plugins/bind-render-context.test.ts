// spec: docs/specs/plugins.md

import { hash } from 'node:crypto';
import { join } from 'node:path';
import { serialize } from 'node:v8';
import { describe, expect, test, vi } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import type { FileTable } from '../build/hash-files.ts';
import type { Observe } from '../build/reuse-unit.ts';
import { bindRenderContext, PluginError } from './bind-render-context.ts';
import type { EmittedFile, Producer } from './bind-render-context.ts';
import type { Output } from './handle-files.ts';
import type { Helper } from './register-plugins.ts';

const source = join(fixturePath('templated'), 'source');

// The walked files a read may reach. notes.txt is on disk but left out, as an
// excluded file would be.
const sourcePaths = ['_.tpl', '_includes/header.tpl', '_partial.txt', 'about.tpl', 'blog/_.tpl', 'blog/_post.tpl', 'blog/hello.tpl', 'index.tpl'];
const files: FileTable = new Map(sourcePaths.map((sourcePath) => [sourcePath, { mtimeNs: 1n, size: 1n, hash: sourcePath }]));

const bodies = new Map([['/', 'The home body.'], ['/blog/hello/', 'The hello body.']]);

const variables = { title: 'Home' };

const here: Helper = (context) => context.sourcePath;
const helpers = new Map([['here', { pluginName: 'tools', helper: here }]]);

// The static files' outputs: two handled, one of them private, and one copy.
const outputs: Output[] = [
  { sourcePath: 'notes.txt', outputPath: 'notes.text', contents: Buffer.from('THE NOTES FILE.\n'), hash: 'notes' },
  { sourcePath: '_partial.txt', outputPath: '_partial.text', contents: Buffer.from('THE PRIVATE PARTIAL.\n'), hash: 'partial' },
  { sourcePath: 'styles/site.css', outputPath: 'styles/site.css', contents: undefined, hash: 'site' },
];

// Call the function a variable holds.
const call = (variables: Record<string, unknown>, name: string, ...args: unknown[]): unknown => {
  const value = variables[name];
  return typeof value === 'function' ? value(...args) : undefined;
};

// The context of a template, which may read bodies, and of a page, which may not.
const makeContext = (sourcePath: string) => bindRenderContext(source, files, helpers, outputs)(sourcePath, variables, bodies, vi.fn(), []);
const makePageContext = (sourcePath: string) => bindRenderContext(source, files, helpers, outputs)(sourcePath, variables, undefined, vi.fn(), []);

describe('bindRenderContext', () => {
  test('the context carries the file and its variables', () => {
    expect(makeContext('index.tpl')).toMatchObject({ sourcePath: 'index.tpl', variables: { title: 'Home' } });
  });

  // spec: docs/specs/plugins.md, Template helpers
  describe('helpers', () => {
    test('a helper sits among the variables under its name and receives the context ahead of the arguments', () => {
      const helper = vi.fn<Helper>(() => 'shouted');
      const context = bindRenderContext(source, files, new Map([['shout', { pluginName: 'tools', helper }]]), outputs)('index.tpl', variables, bodies, vi.fn(), []);
      expect(context.variables).toStrictEqual({ title: 'Home', shout: expect.any(Function) });
      expect(call(context.variables, 'shout', 'hi', 2)).toBe('shouted');
      expect(helper).toHaveBeenCalledExactlyOnceWith({ ...context, emit: expect.any(Function) }, 'hi', 2);
    });

    test('the variables handed in are left as they were', () => {
      makeContext('index.tpl');
      expect(variables).toStrictEqual({ title: 'Home' });
    });

    test("a helper's name wins over a variable handed in under it", () => {
      const context = bindRenderContext(source, files, helpers, outputs)('index.tpl', { here: 'shadow' }, bodies, vi.fn(), []);
      expect(call(context.variables, 'here')).toBe('index.tpl');
    });
  });

  // spec: docs/specs/plugins.md, Emitted files
  describe('emit', () => {
    const produce: Producer = () => Promise.resolve('derived');

    // A context whose `derive` helper, of the plugin `images`, emits what it is called with.
    const bind = (sourcePath: string, emits: EmittedFile[]) => {
      const derive: Helper = (context, outputPath, parameters, producer) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- what a template passes, unchecked
        context.emit(outputPath as string, parameters, producer as Producer);
      };
      return bindRenderContext(source, files, new Map([['derive', { pluginName: 'images', helper: derive }]]), outputs)(sourcePath, variables, bodies, vi.fn(), emits);
    };

    test("a helper's emit pushes the file with the helper's plugin, the file rendering, the path, the parameters' hash, and the producer", () => {
      const emits: EmittedFile[] = [];
      call(bind('blog/_.tpl', emits).variables, 'derive', 'images/photo-300.webp', { width: 300 }, produce);
      expect(emits).toStrictEqual([{
        pluginName: 'images',
        sourcePath: 'blog/_.tpl',
        outputPath: 'images/photo-300.webp',
        parametersHash: hash('sha256', serialize({ width: 300 }), 'hex'),
        produce,
      }]);
    });

    test('equal parameters carry one hash and different parameters two', () => {
      const emits: EmittedFile[] = [];
      const { variables: seen } = bind('index.tpl', emits);
      call(seen, 'derive', 'a.webp', { width: 300 }, produce);
      call(seen, 'derive', 'b.webp', { width: 300 }, produce);
      call(seen, 'derive', 'c.webp', { width: 400 }, produce);
      expect(emits[0]?.parametersHash).toBe(emits[1]?.parametersHash);
      expect(emits[2]?.parametersHash).not.toBe(emits[0]?.parametersHash);
    });

    test.each([
      ['a leading slash', '/images/photo.webp', '"/images/photo.webp"'],
      ['a .. segment', 'images/../../photo.webp', '"images/../../photo.webp"'],
      ['a number', 7, '7'],
    ])("a path with %s fails as the helper's plugin, naming the file and the path", (_name, outputPath, printed) => {
      const { variables: seen } = bind('index.tpl', []);
      expect(() => call(seen, 'derive', outputPath, {}, produce)).toThrow(expect.objectContaining({
        pluginName: 'images',
        message: `index.tpl emits ${printed}, which is not a plain path under the destination.`,
      }));
    });

    test('a producer that is not a function fails naming the file and the path', () => {
      const { variables: seen } = bind('index.tpl', []);
      expect(() => call(seen, 'derive', 'a.webp', {}, 'resize')).toThrow(expect.objectContaining({
        pluginName: 'images',
        message: 'index.tpl emits a.webp with a producer that is not a function.',
      }));
    });

    test('parameters the build cannot serialize fail with the serializer\'s message', () => {
      const { variables: seen } = bind('index.tpl', []);
      expect(() => call(seen, 'derive', 'a.webp', { resize: () => 1 }, produce)).toThrow(/^index\.tpl emits a\.webp with parameters the build cannot serialize: .+/);
    });

    test("the context a renderer receives, and a partial's, cannot emit", () => {
      const context = bind('_.tpl', []);
      expect(() => {
        context.emit('a.webp', {}, produce);
      }).toThrow(new Error('_.tpl emits a.webp outside a helper, which only a helper can do.'));
      const entered = context.enterFile('_partial.txt', {});
      expect(() => {
        entered.emit('a.webp', {}, produce);
      }).toThrow(new Error('_partial.txt emits a.webp outside a helper, which only a helper can do.'));
    });

    test("a helper called while a partial renders pushes onto the including file's list, naming the partial", () => {
      const emits: EmittedFile[] = [];
      call(bind('_.tpl', emits).enterFile('_partial.txt', {}).variables, 'derive', 'a.webp', {}, produce);
      expect(emits).toStrictEqual([expect.objectContaining({ sourcePath: '_partial.txt', outputPath: 'a.webp' })]);
    });
  });

  // spec: docs/specs/plugins.md, Errors
  describe("a helper's throw", () => {
    const bind = (helper: Helper, pluginName = 'tools') =>
      bindRenderContext(source, files, new Map([['fail', { pluginName, helper }]]), outputs)('index.tpl', variables, bodies, vi.fn(), []);

    test("an Error comes out as a PluginError carrying the helper's plugin, the message, and the Error as cause", () => {
      const cause = new Error('boom');
      const context = bind(() => { throw cause; });
      expect(() => call(context.variables, 'fail')).toThrow(PluginError);
      expect(() => call(context.variables, 'fail')).toThrow(expect.objectContaining({ pluginName: 'tools', message: 'boom', cause }));
    });

    test("a thrown string is the PluginError's message", () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the throw a JavaScript helper can make
      const context = bind(() => { throw 'boom'; });
      expect(() => call(context.variables, 'fail')).toThrow(expect.objectContaining({ pluginName: 'tools', message: 'boom', cause: 'boom' }));
    });

    test('a PluginError of another plugin comes out as it is', () => {
      const tagged = new PluginError('inner', new Error('boom'));
      const context = bind(() => { throw tagged; });
      expect(() => call(context.variables, 'fail')).toThrow(tagged);
    });
  });

  // spec: docs/specs/templates.md, Relative paths
  describe('readFile', () => {
    test("a relative path resolves against the file's directory, at the root or below", () => {
      expect(makeContext('_.tpl').readFile('_partial.txt')).toBe('The private partial.\n');
      expect(makeContext('blog/_.tpl').readFile('../_partial.txt')).toBe('The private partial.\n');
    });

    test('an absolute path resolves against the source root, into a private directory too', () => {
      expect(makeContext('blog/_.tpl').readFile('/_includes/header.tpl')).toBe('The header include.\n');
      expect(makeContext('about.tpl').readFile('/blog/hello.tpl')).toContain('The hello post');
    });

    test('a path at which the walk saw no file yields no value, whether or not the disk holds one', () => {
      expect(makeContext('about.tpl').readFile('missing.txt')).toBeUndefined();
      expect(makeContext('about.tpl').readFile('notes.txt')).toBeUndefined();
      expect(makeContext('about.tpl').readFile('/_includes')).toBeUndefined();
    });

    test('a path above the source root is an error naming the file and the path', () => {
      expect(() => makeContext('_.tpl').readFile('../secret.txt')).toThrow(new Error('_.tpl reads ../secret.txt, which is above the source root.'));
      expect(() => makeContext('_.tpl').readFile('/../secret.txt')).toThrow(new Error('_.tpl reads /../secret.txt, which is above the source root.'));
      expect(() => makeContext('blog/_.tpl').readFile('../..')).toThrow(new Error('blog/_.tpl reads ../.., which is above the source root.'));
    });
  });

  describe('enterFile', () => {
    test("a relative reference resolves against the file's directory and an absolute one against the source root", () => {
      expect(makeContext('blog/_.tpl').enterFile('../_partial.txt', {})).toMatchObject({ sourcePath: '_partial.txt' });
      expect(makeContext('blog/_.tpl').enterFile('/_includes/header.tpl', {})).toMatchObject({ sourcePath: '_includes/header.tpl' });
    });

    test("the entered context has the data over the file's variables, with the helpers bound to it", () => {
      const entered = makeContext('blog/_.tpl').enterFile('/_includes/header.tpl', { name: 'Ada' });
      expect(entered.variables).toStrictEqual({ name: 'Ada', title: 'Home', here: expect.any(Function) });
      expect(call(entered.variables, 'here')).toBe('_includes/header.tpl');
    });

    test("data under a helper's name is replaced by the helper", () => {
      const entered = makeContext('_.tpl').enterFile('_partial.txt', { here: 'shadow' });
      expect(call(entered.variables, 'here')).toBe('_partial.txt');
    });

    test("data wins over the file's variable of the same name, and the rest read through", () => {
      const entered = bindRenderContext(source, files, helpers, outputs)('_.tpl', { title: 'Home', year: 2000 }, bodies, vi.fn(), []).enterFile('_partial.txt', { year: 2024 });
      expect(entered.variables.year).toBe(2024);
      expect(entered.variables.title).toBe('Home');
      expect('title' in entered.variables).toBe(true);
      expect(Object.keys(entered.variables)).toStrictEqual(['year', 'title', 'here']);
      expect(Object.getOwnPropertyDescriptor(entered.variables, 'title')).toStrictEqual({ value: 'Home', writable: true, enumerable: true, configurable: true });
    });

    test("an assignment on the entered variables lands on the data, never on the file's variables", () => {
      const handed: Record<string, unknown> = { title: 'Home', name: 'Site' };
      const entered = bindRenderContext(source, files, helpers, outputs)('_.tpl', handed, bodies, vi.fn(), []).enterFile('_partial.txt', { year: 2024 });
      entered.variables.added = 1;
      entered.variables.name = 'Other';
      expect({ ...entered.variables }).toStrictEqual({ year: 2024, added: 1, name: 'Other', title: 'Home', here: expect.any(Function) });
      expect(handed).toStrictEqual({ title: 'Home', name: 'Site' });
    });

    test("entering a partial enumerates nothing of the file's variables", () => {
      const observe = vi.fn<Observe>();
      bindRenderContext(source, files, helpers, outputs)('_.tpl', variables, bodies, observe, []).enterFile('_partial.txt', { year: 2024 });
      expect(observe.mock.calls.map(([kind]) => kind)).not.toContain('globals');
    });

    test('the entered context reads relative to the entered file and reads the same bodies', () => {
      const entered = makeContext('blog/_.tpl').enterFile('/_includes/header.tpl', {});
      expect(entered.readFile('../_partial.txt')).toBe('The private partial.\n');
      expect(entered.readBody('/')).toBe('The home body.');
    });

    test("a reference above the source root is the read's error", () => {
      expect(() => makeContext('_.tpl').enterFile('../secret.txt', {})).toThrow(new Error('_.tpl reads ../secret.txt, which is above the source root.'));
    });

    test('a reference the walk saw no file at is an error naming the file and the reference', () => {
      expect(() => makeContext('about.tpl').enterFile('notes.txt', {})).toThrow(new Error('about.tpl enters notes.txt, but no file is there.'));
    });
  });

  describe('readOutput', () => {
    test('a handled output is the very buffer the build writes, by a relative or an absolute reference', () => {
      expect(makeContext('_.tpl').readOutput('notes.text')).toBe(outputs[0]?.contents);
      expect(makeContext('blog/_.tpl').readOutput('../notes.text')?.toString()).toBe('THE NOTES FILE.\n');
      expect(makeContext('blog/_.tpl').readOutput('/notes.text')?.toString()).toBe('THE NOTES FILE.\n');
    });

    test('a copy is read from its source file', () => {
      expect(makeContext('_.tpl').readOutput('styles/site.css')?.toString()).toBe('body { margin: 0; }\n');
    });

    test('a private handled output is readable though it is never written', () => {
      expect(makeContext('blog/_post.tpl').readOutput('/_partial.text')?.toString()).toBe('THE PRIVATE PARTIAL.\n');
    });

    test('a path no output has yields no value, a source path a handler renamed included', () => {
      expect(makeContext('_.tpl').readOutput('notes.txt')).toBeUndefined();
      expect(makeContext('_.tpl').readOutput('/missing.css')).toBeUndefined();
    });

    test("a path above the source root is the read's error", () => {
      expect(() => makeContext('_.tpl').readOutput('../site.css')).toThrow(new Error('_.tpl reads ../site.css, which is above the source root.'));
    });
  });

  describe('readBody', () => {
    test("another page's body is read by its URL", () => {
      expect(makeContext('blog/_archive.tpl').readBody('/blog/hello/')).toBe('The hello body.');
    });

    test("a page's own body may not read a body, and the error names both pages", () => {
      expect(() => makePageContext('blog/index.tpl').readBody('/blog/hello/')).toThrow(
        new Error('blog/index.tpl reads the body of /blog/hello/ while its own body renders, which only a template can do.'),
      );
    });

    test('a URL no page has is an error naming the file and the URL', () => {
      expect(() => makeContext('blog/_archive.tpl').readBody('/blog/missing/')).toThrow(
        new Error('blog/_archive.tpl reads the body of /blog/missing/, but no page has that URL.'),
      );
    });
  });

  // spec: docs/specs/build.md, Incremental builds
  describe('observing', () => {
    const bind = (sourcePath: string, observe: Observe, handed: Record<string, unknown> = { title: 'Home' }) =>
      bindRenderContext(source, files, helpers, outputs)(sourcePath, handed, bodies, observe, []);

    test('each read operation observes its input, an absent file and an absent output included', () => {
      const observe = vi.fn<Observe>();
      const context = bind('_.tpl', observe);
      context.readFile('_partial.txt');
      context.readFile('missing.txt');
      context.readOutput('notes.text');
      context.readOutput('/missing.css');
      context.readBody('/');
      expect(observe.mock.calls).toStrictEqual([['file', '_partial.txt'], ['file', 'missing.txt'], ['output', 'notes.text'], ['output', 'missing.css'], ['body', '/']]);
    });

    test('a body read a page may not make observes nothing', () => {
      const observe = vi.fn<Observe>();
      const context = bindRenderContext(source, files, helpers, outputs)('index.tpl', variables, undefined, observe, []);
      expect(() => context.readBody('/')).toThrow(/while its own body renders/);
      expect(observe).not.toHaveBeenCalled();
    });

    test('a variable read, a has check, and a descriptor check observe the name, defined or not, and an enumeration observes every global', () => {
      const observe = vi.fn<Observe>();
      const { variables: seen } = bind('_.tpl', observe);
      expect(seen.title).toBe('Home');
      expect(seen.missing).toBeUndefined();
      expect('title' in seen).toBe(true);
      expect(Object.hasOwn(seen, 'missing')).toBe(false);
      expect(Object.keys(seen)).toStrictEqual(['title', 'here']);
      expect({ ...seen }).toStrictEqual({ title: 'Home', here: expect.any(Function) });
      expect(observe.mock.calls.slice(0, 5)).toStrictEqual([['global', 'title'], ['global', 'missing'], ['global', 'title'], ['global', 'missing'], ['globals', '']]);
      expect(observe.mock.calls.slice(5)).toContainEqual(['globals', '']);
    });

    test('a symbol key is forwarded and not observed', () => {
      const observe = vi.fn<Observe>();
      const { variables: seen } = bind('_.tpl', observe);
      expect(Reflect.get(seen, Symbol.iterator)).toBeUndefined();
      expect(Symbol.iterator in seen).toBe(false);
      expect(Object.getOwnPropertyDescriptor(seen, Symbol.iterator)).toBeUndefined();
      expect(observe).not.toHaveBeenCalled();
    });

    test('a helper is answered without being observed, by a read, a has check, and a descriptor check alike', () => {
      const observe = vi.fn<Observe>();
      const { variables: seen } = bind('_.tpl', observe);
      expect(call(seen, 'here')).toBe('_.tpl');
      expect('here' in seen).toBe(true);
      expect(Object.getOwnPropertyDescriptor(seen, 'here')).toStrictEqual({ value: expect.any(Function), writable: true, enumerable: true, configurable: true });
      expect(observe).not.toHaveBeenCalled();
    });

    test("an enumeration of variables that already hold a helper's name lists it once, with the helper as its value", () => {
      const { variables: seen } = bind('_.tpl', vi.fn(), { here: 'shadow', title: 'Home' });
      expect(Object.keys(seen)).toStrictEqual(['here', 'title']);
      expect({ ...seen }).toStrictEqual({ here: expect.any(Function), title: 'Home' });
    });

    test("an assignment lands on the object handed in as an ordinary property, under a helper's name too, and the helper still answers", () => {
      const handed: Record<string, unknown> = { title: 'Home' };
      const { variables: seen } = bind('_.tpl', vi.fn(), handed);
      seen.added = 1;
      seen.here = 'shadow';
      expect(handed).toStrictEqual({ title: 'Home', added: 1, here: 'shadow' });
      expect(Object.getOwnPropertyDescriptor(handed, 'here')).toStrictEqual({ value: 'shadow', writable: true, enumerable: true, configurable: true });
      expect(call(seen, 'here')).toBe('_.tpl');
    });

    test("the partial's context observes through the same function", () => {
      const observe = vi.fn<Observe>();
      const entered = bind('blog/_.tpl', observe).enterFile('/_includes/header.tpl', { name: 'Ada' });
      entered.readFile('../_partial.txt');
      expect(entered.variables.name).toBe('Ada');
      expect(observe.mock.calls).toStrictEqual([['file', '_partial.txt'], ['global', 'name']]);
    });
  });
});
