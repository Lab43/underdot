// spec: q-docs/specs/collections.md

import type { HookPage } from 'underdot';
import { describe, expect, test } from 'vitest';
import { collectPages } from './collect-pages.ts';

// A page as the hook sees it, at the URL its source path gives it.
const makePage = (sourcePath: string, url: string, frontmatter: Record<string, unknown> = {}): HookPage => ({
  sourcePath,
  outputPath: `${url.slice(1)}index.html`,
  url,
  frontmatter,
});

const home = makePage('index.ejs', '/', { title: 'Home' });
const about = makePage('about.ejs', '/about/', { title: 'About' });
const hello = makePage('posts/hello.ejs', '/posts/hello/', { title: 'Hello', date: new Date('2024-01-02') });
const deep = makePage('posts/2024/deep.ejs', '/posts/2024/deep/', { title: 'Deep' });

describe('collectPages', () => {
  test('a page below the directory at any depth is a member, and a page outside it is not', () => {
    const { posts } = collectPages([home, hello, about, deep], { posts: 'posts' });
    expect(posts!.map((item) => item._url)).toStrictEqual(['/posts/hello/', '/posts/2024/deep/']);
  });

  test.each(['posts.ejs', 'posts/index.ejs'])("the directory's own page, written as %s, is not a member", (sourcePath) => {
    const own = makePage(sourcePath, '/posts/', { title: 'Posts' });
    expect(collectPages([own, hello], { posts: 'posts' })).toStrictEqual({ posts: [{ ...hello.frontmatter, _url: '/posts/hello/' }] });
  });

  test("a page whose URL shares the prefix's letters without its slash is not a member", () => {
    const postsy = makePage('postsy.ejs', '/postsy/', { title: 'Postsy' });
    expect(collectPages([postsy, hello], { posts: 'posts' })).toStrictEqual({ posts: [{ ...hello.frontmatter, _url: '/posts/hello/' }] });
  });

  test("an item is the page's frontmatter plus _url and nothing else", () => {
    const { posts } = collectPages([hello], { posts: 'posts' });
    expect(posts).toStrictEqual([{ title: 'Hello', date: new Date('2024-01-02'), _url: '/posts/hello/' }]);
    expect(posts![0]).not.toHaveProperty('sourcePath');
    expect(posts![0]).not.toHaveProperty('outputPath');
  });

  test('the items keep the order the pages came in, unsorted', () => {
    const { posts } = collectPages([deep, hello], { posts: 'posts' });
    expect(posts!.map((item) => item._url)).toStrictEqual(['/posts/2024/deep/', '/posts/hello/']);
  });

  test('the list and each item are frozen, so a sort in place fails', () => {
    const { posts } = collectPages([hello, deep], { posts: 'posts' });
    expect(Object.isFrozen(posts)).toBe(true);
    expect(posts!.every((item) => Object.isFrozen(item))).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the sort a template would attempt
    expect(() => (posts as unknown[]).sort()).toThrow(TypeError);
  });

  test('a directory under which no page is defines an empty list', () => {
    expect(collectPages([home, about], { posts: 'posts' })).toStrictEqual({ posts: [] });
  });

  test('two collections come back under their names', () => {
    const team = makePage('about/team.ejs', '/about/team/', { title: 'Team' });
    expect(collectPages([home, hello, team], { posts: 'posts', people: 'about' })).toStrictEqual({
      posts: [{ ...hello.frontmatter, _url: '/posts/hello/' }],
      people: [{ title: 'Team', _url: '/about/team/' }],
    });
  });

  test('no directories define nothing', () => {
    expect(collectPages([home, hello], {})).toStrictEqual({});
  });
});
