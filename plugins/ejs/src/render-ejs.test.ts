// spec: docs/specs/ejs.md

import type { RenderContext } from 'underdot';
import { describe, expect, test, vi } from 'vitest';
import { renderEjs } from './render-ejs.ts';

// The files a read may reach, keyed by the absolute reference the renderer
// resolves every include to before reading.
const files: Record<string, string> = {
  '/note.txt': 'a note',
  '/blog/byline.ejs': 'blog byline',
  '/blog/head.ejs': 'blog head',
  '/_includes/head.ejs': 'views head[<%= description %>]',
  '/_includes/meta.ejs': 'meta <%= _url %>',
  '/_includes/nested.ejs': 'nested(<%- include("./meta") %>)',
  '/_includes/footer.ejs': 'footer <%= year %> <%= name %> <%- include("./copyright") %>',
  '/_includes/copyright.ejs': '© <%= year %>',
  '/_includes/bad.ejs': '<%= nope.deep %>',
  '/_includes/where.ejs': 'at <%= here() %>',
  '/_partials/footer.ejs': 'partials footer',
};

interface Case {
  sourcePath?: string;
  variables?: Record<string, unknown>;
  views?: string[];
}

// A context over the files above. An entered file's context carries the
// variables given and a `here` helper bound to the entered path.
const makeContext = (sourcePath: string, variables: Record<string, unknown>, readFile: RenderContext['readFile']): RenderContext => ({
  sourcePath,
  variables,
  readFile,
  readOutput: () => undefined,
  readBody: () => '',
  enterFile: (reference, entered) => makeContext(reference.slice(1), { ...entered, here: () => reference.slice(1) }, readFile),
});

// Render with a context over the files above. The renderer resolves every
// reference itself, so the context only ever sees an absolute one.
const render = (body: string, { sourcePath = 'index.ejs', variables = {}, views = [] }: Case = {}): string => {
  const readFile = vi.fn((reference: string) => files[reference]);
  try {
    return renderEjs(body, makeContext(sourcePath, variables, readFile), views);
  } finally {
    for (const [reference] of readFile.mock.calls) {
      expect(reference).toMatch(/^\//);
    }
  }
};

describe('renderEjs', () => {
  describe('variables', () => {
    test('the escaping tag escapes a variable and the raw tag prints it as it is', () => {
      expect(render('<%= markup %>|<%- markup %>', { variables: { markup: '<b>&</b>' } })).toBe('&lt;b&gt;&amp;&lt;/b&gt;|<b>&</b>');
    });

    test('a variable no file set prints as nothing, is undefined, and is absent from locals', () => {
      expect(render('[<%= missing %>][<%= typeof missing %>][<%= locals.missing %>]')).toBe('[][undefined][]');
    });

    test('locals holds the same variables', () => {
      expect(render('<%= locals.title %>', { variables: { title: 'Home' } })).toBe('Home');
    });

    test('a runtime global is reachable', () => {
      const body = '<%- JSON.stringify(team) %> <%= Math.max(1, 2) %> <%= new Date(0).toISOString() %> <%= encodeURIComponent("a b") %>';
      expect(render(body, { variables: { team: { leads: ['Ada'] } } })).toBe('{"leads":["Ada"]} 2 1970-01-01T00:00:00.000Z a%20b');
    });

    test("a variable sharing a global's name shadows it", () => {
      expect(render('<%= JSON %>', { variables: { JSON: 'shadow' } })).toBe('shadow');
    });

    test('include is the renderer\'s function whatever a variable of that name holds', () => {
      expect(render('<%= typeof include %> <%= typeof locals.include %>', { variables: { include: 'shadow' } })).toBe('function function');
    });

    test('a variable named like one of EJS\'s own names is reachable only through locals', () => {
      const variables = { locals: 'shadow', escapeFn: 'shadow', title: '<b>' };
      expect(render('<%= locals.locals %> <%= locals.escapeFn %> <%= title %>', { variables })).toBe('shadow shadow &lt;b&gt;');
    });

    test('a scriptlet can declare a const and a let', () => {
      expect(render('<% const a = 1; let b = 2; b += 1; %><%= a + b %>')).toBe('4');
    });

    test('a function among the variables is called by its name', () => {
      expect(render('<%= shout("hi") %>', { variables: { shout: (word: string) => word.toUpperCase() } })).toBe('HI');
    });

    test("a var assigned in a scriptlet leaves the context's variables unchanged", () => {
      const variables = { title: 'Home' };
      expect(render("<% var title = 'Changed'; %><%= title %>", { variables })).toBe('Changed');
      expect(variables).toStrictEqual({ title: 'Home' });
    });
  });

  describe('includes', () => {
    test("a relative include resolves in the file's directory, with .ejs added", () => {
      expect(render("<%- include('byline') %>", { sourcePath: 'blog/post.ejs' })).toBe('blog byline');
    });

    test('an extension given is kept', () => {
      expect(render("<%- include('note.txt') %>")).toBe('a note');
    });

    test("a relative include may climb out of the file's directory", () => {
      expect(render("<%- include('../note.txt') %>", { sourcePath: 'blog/post.ejs' })).toBe('a note');
    });

    test("the file's directory wins over the views", () => {
      expect(render("<%- include('head') %>", { sourcePath: 'blog/post.ejs', views: ['_includes'] })).toBe('blog head');
    });

    test('the views are searched in their order', () => {
      const views = ['_partials', '_includes'];
      expect(render("<%- include('footer') %>", { views })).toBe('partials footer');
      expect(render("<%- include('head') %>", { views })).toBe('views head[]');
    });

    test('an absolute include resolves from the source root and is not searched in the views', () => {
      expect(render("<%- include('/_includes/head') %>", { sourcePath: 'blog/post.ejs', views: ['_includes'] })).toBe('views head[]');
      expect(() => render("<%- include('/head') %>", { sourcePath: 'blog/post.ejs', views: ['_includes'] })).toThrow('No include /head is under the source root.');
    });

    test("a nested include resolves against the partial's directory, not the including file's", () => {
      expect(render("<%- include('/_includes/nested') %>", { sourcePath: 'blog/post.ejs', variables: { _url: '/blog/post/' } })).toBe('nested(meta /blog/post/)');
    });

    test('include data overrides a variable in the partial and the partials nested in it', () => {
      const variables = { year: 2000, name: 'Site' };
      expect(render("<%- include('/_includes/footer', { year: 2024 }) %>", { variables })).toBe('footer 2024 Site © 2024');
    });

    // spec: docs/specs/plugins.md, Template helpers
    test('a partial renders as the file being rendered, entered with the merged variables', () => {
      const context = makeContext('blog/post.ejs', { year: 2000, name: 'Site' }, (reference) => files[reference]);
      const enterFile = vi.spyOn(context, 'enterFile');
      expect(renderEjs("<%- include('/_includes/where', { year: 2024 }) %>", context, [])).toBe('at _includes/where.ejs');
      expect(enterFile).toHaveBeenCalledExactlyOnceWith('/_includes/where.ejs', { year: 2024, name: 'Site' });
    });

    test('a partial reads a variable no file set as nothing', () => {
      expect(render("<%- include('/_includes/head') %>")).toBe('views head[]');
    });

    test('a relative include found nowhere names the directory searched, the source root for a root file', () => {
      expect(() => render("<%- include('nothing') %>", { sourcePath: 'blog/post.ejs' })).toThrow('No include nothing is in blog or in the views directories.');
      expect(() => render("<%- include('nothing') %>")).toThrow('No include nothing is in the source root or in the views directories.');
    });

    test('the engine reports a missing include with the including file and line', () => {
      expect(() => render("<%- include('nothing') %>")).toThrow(
        "index.ejs:1\n >> 1| <%- include('nothing') %>\n\nNo include nothing is in the source root or in the views directories.",
      );
    });

    test('an absolute include found nowhere says so', () => {
      expect(() => render("<%- include('/nothing') %>")).toThrow('No include /nothing is under the source root.');
    });

    test("an error the context's read throws propagates", () => {
      const context = makeContext('index.ejs', {}, () => {
        throw new Error('index.ejs reads /../secret.ejs, which is above the source root.');
      });
      expect(() => renderEjs("<%- include('/../secret') %>", context, [])).toThrow('index.ejs reads /../secret.ejs, which is above the source root.');
    });

    test('the legacy include directive is a syntax error', () => {
      expect(() => render('<% include head %>')).toThrow(SyntaxError);
    });
  });

  describe('errors', () => {
    test('a runtime error reports the file, the line, and the marked source', () => {
      expect(() => render('line one\n<%= nope.deep %>\nline three')).toThrow(
        'index.ejs:2\n    1| line one\n >> 2| <%= nope.deep %>\n    3| line three\n\nCannot read properties of undefined',
      );
    });

    test("a runtime error inside a partial reports the partial's path", () => {
      expect(() => render("<%- include('/_includes/bad') %>")).toThrow('_includes/bad.ejs:1\n >> 1| <%= nope.deep %>\n\nCannot read properties of undefined');
    });
  });
});
