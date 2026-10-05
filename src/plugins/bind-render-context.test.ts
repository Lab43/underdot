// spec: docs/specs/plugins.md

import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { bindRenderContext } from './bind-render-context.ts';
import type { Output } from './handle-files.ts';
import type { Helper } from './register-plugins.ts';

const source = join(fixturePath('templated'), 'source');

// The walked files a read may reach. notes.txt is on disk but left out, as an
// excluded file would be.
const sourcePaths = new Set(['_.tpl', '_includes/header.tpl', '_partial.txt', 'about.tpl', 'blog/_.tpl', 'blog/_post.tpl', 'blog/hello.tpl', 'index.tpl']);

const bodies = new Map([['/', 'The home body.'], ['/blog/hello/', 'The hello body.']]);

const variables = { title: 'Home' };

const here: Helper = (context) => context.sourcePath;
const helpers = new Map([['here', { pluginName: 'tools', helper: here }]]);

// The static files' outputs: two handled, one of them private, and one copy.
const outputs: Output[] = [
  { sourcePath: 'notes.txt', outputPath: 'notes.text', contents: Buffer.from('THE NOTES FILE.\n') },
  { sourcePath: '_partial.txt', outputPath: '_partial.text', contents: Buffer.from('THE PRIVATE PARTIAL.\n') },
  { sourcePath: 'styles/site.css', outputPath: 'styles/site.css', contents: undefined },
];

// Call the function a variable holds.
const call = (variables: Record<string, unknown>, name: string, ...args: unknown[]): unknown => {
  const value = variables[name];
  return typeof value === 'function' ? value(...args) : undefined;
};

// The context of a template, which may read bodies, and of a page, which may not.
const makeContext = (sourcePath: string) => bindRenderContext(source, sourcePaths, helpers, outputs)(sourcePath, variables, bodies);
const makePageContext = (sourcePath: string) => bindRenderContext(source, sourcePaths, helpers, outputs)(sourcePath, variables, undefined);

describe('bindRenderContext', () => {
  test('the context carries the file and its variables', () => {
    expect(makeContext('index.tpl')).toMatchObject({ sourcePath: 'index.tpl', variables: { title: 'Home' } });
  });

  // spec: docs/specs/plugins.md, Template helpers
  describe('helpers', () => {
    test('a helper sits among the variables under its name and receives the context ahead of the arguments', () => {
      const helper = vi.fn<Helper>(() => 'shouted');
      const context = bindRenderContext(source, sourcePaths, new Map([['shout', { pluginName: 'tools', helper }]]), outputs)('index.tpl', variables, bodies);
      expect(context.variables).toStrictEqual({ title: 'Home', shout: expect.any(Function) });
      expect(call(context.variables, 'shout', 'hi', 2)).toBe('shouted');
      expect(helper).toHaveBeenCalledExactlyOnceWith(context, 'hi', 2);
    });

    test('the variables handed in are left as they were', () => {
      makeContext('index.tpl');
      expect(variables).toStrictEqual({ title: 'Home' });
    });

    test("a helper's name wins over a variable handed in under it", () => {
      const context = bindRenderContext(source, sourcePaths, helpers, outputs)('index.tpl', { here: 'shadow' }, bodies);
      expect(call(context.variables, 'here')).toBe('index.tpl');
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

    test('the entered context has the variables given, with the helpers bound to it', () => {
      const entered = makeContext('blog/_.tpl').enterFile('/_includes/header.tpl', { name: 'Ada' });
      expect(entered.variables).toStrictEqual({ name: 'Ada', here: expect.any(Function) });
      expect(call(entered.variables, 'here')).toBe('_includes/header.tpl');
    });

    test("a variable handed in under a helper's name is replaced by the helper", () => {
      const entered = makeContext('_.tpl').enterFile('_partial.txt', { here: 'shadow' });
      expect(call(entered.variables, 'here')).toBe('_partial.txt');
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
});
