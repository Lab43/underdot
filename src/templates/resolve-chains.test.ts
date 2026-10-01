// spec: docs/specs/templates.md, Template resolution

import { describe, expect, test } from 'vitest';
import { makePage } from '../../test/helpers/make-page.ts';
import { makeTemplate } from '../../test/helpers/make-template.ts';
import { resolveChains } from './resolve-chains.ts';

const root = makeTemplate({ sourcePath: '_.tpl' });
const rootPost = makeTemplate({ sourcePath: '_post.tpl', name: '_post' });
const blogRoot = makeTemplate({ sourcePath: 'blog/_.tpl', directory: 'blog' });
const blogPost = makeTemplate({ sourcePath: 'blog/_post.tpl', directory: 'blog', name: '_post' });

const home = makePage({ sourcePath: 'index.tpl' });
const hello = makePage({ sourcePath: 'blog/hello.tpl', directory: 'blog' });
const helloPost = makePage({ sourcePath: 'blog/hello.tpl', directory: 'blog', template: 'post' });

describe('resolveChains', () => {
  test('a page at the root takes the root _', () => {
    expect(resolveChains([home], [root])).toStrictEqual([{ page: home, chain: [root] }]);
  });

  test('a page in a directory with no _ of its own takes the root _', () => {
    expect(resolveChains([hello], [root])).toStrictEqual([{ page: hello, chain: [root] }]);
  });

  test("a directory's _ comes before the root _, which searches strictly above itself", () => {
    expect(resolveChains([hello], [root, blogRoot])).toStrictEqual([{ page: hello, chain: [blogRoot, root] }]);
  });

  test('a page two directories down searches each parent in turn', () => {
    const deep = makePage({ sourcePath: 'blog/2024/hello.tpl', directory: 'blog/2024' });
    expect(resolveChains([deep], [root, blogRoot])).toStrictEqual([{ page: deep, chain: [blogRoot, root] }]);
  });

  test("a directive takes the directory's template over the root's", () => {
    expect(resolveChains([helloPost], [root, rootPost, blogPost])).toStrictEqual([{ page: helloPost, chain: [blogPost, root] }]);
  });

  test('a directive with no template in its own directory searches upward', () => {
    const team = makePage({ sourcePath: 'about/team.tpl', directory: 'about', template: 'post' });
    expect(resolveChains([team], [root, rootPost])).toStrictEqual([{ page: team, chain: [rootPost, root] }]);
  });

  test("a template's own directive selects its parent", () => {
    const post = makeTemplate({ sourcePath: '_post.tpl', name: '_post', template: 'wide' });
    const wide = makeTemplate({ sourcePath: '_wide.tpl', name: '_wide' });
    const page = makePage({ sourcePath: 'index.tpl', template: 'post' });
    expect(resolveChains([page], [root, post, wide])).toStrictEqual([{ page, chain: [post, wide, root] }]);
  });

  test('a _ with no _ above it is a root, so a site needs no _ at the source root', () => {
    expect(resolveChains([hello], [blogRoot])).toStrictEqual([{ page: hello, chain: [blogRoot] }]);
  });

  test("chains come back in the pages' order", () => {
    expect(resolveChains([hello, home], [root, blogRoot])).toStrictEqual([
      { page: hello, chain: [blogRoot, root] },
      { page: home, chain: [root] },
    ]);
  });

  test('a page whose search finds no _ fails naming the page and _', () => {
    expect(() => resolveChains([hello], [rootPost])).toThrow(
      new Error('No template _ is in the directory of blog/hello.tpl or above it.'),
    );
  });

  test('a directive no directory satisfies fails naming the page and the template', () => {
    const page = makePage({ sourcePath: 'index.tpl', template: 'missing' });
    expect(() => resolveChains([page], [root])).toThrow(
      new Error('No template _missing is in the directory of index.tpl or above it.'),
    );
  });

  test("a template's directive no directory satisfies fails naming the template", () => {
    const post = makeTemplate({ sourcePath: 'blog/_post.tpl', directory: 'blog', name: '_post', template: 'missing' });
    expect(() => resolveChains([helloPost], [root, post])).toThrow(
      new Error('No template _missing is in the directory of blog/_post.tpl or above it.'),
    );
  });

  test('two templates with one name in one directory fail naming both and the directory', () => {
    const templates = [
      makeTemplate({ sourcePath: 'blog/_a.tpl', directory: 'blog', name: '_a' }),
      makeTemplate({ sourcePath: 'blog/_a.md', directory: 'blog', extension: 'md', name: '_a' }),
    ];
    expect(() => resolveChains([], templates)).toThrow(new Error('Both blog/_a.tpl and blog/_a.md are the template _a in blog.'));
  });

  test('two templates with one name at the root fail naming the source root', () => {
    const templates = [
      makeTemplate({ sourcePath: '_a.tpl', name: '_a' }),
      makeTemplate({ sourcePath: '_a.md', extension: 'md', name: '_a' }),
    ];
    expect(() => resolveChains([], templates)).toThrow(new Error('Both _a.tpl and _a.md are the template _a in the source root.'));
  });

  test('a template that asks for itself fails naming it', () => {
    const post = makeTemplate({ sourcePath: 'blog/_post.tpl', directory: 'blog', name: '_post', template: 'post' });
    expect(() => resolveChains([helloPost], [root, post])).toThrow(
      new Error('blog/_post.tpl asks for blog/_post.tpl, which is already in its chain.'),
    );
  });

  test('two templates that ask for each other fail naming the one asked for again', () => {
    const a = makeTemplate({ sourcePath: '_a.tpl', name: '_a', template: 'b' });
    const b = makeTemplate({ sourcePath: '_b.tpl', name: '_b', template: 'a' });
    const page = makePage({ sourcePath: 'index.tpl', template: 'a' });
    expect(() => resolveChains([page], [root, a, b])).toThrow(
      new Error('_b.tpl asks for _a.tpl, which is already in its chain.'),
    );
  });
});
