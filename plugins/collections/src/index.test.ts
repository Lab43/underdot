// spec: docs/specs/collections.md

import type { HookPage, RenderContext } from 'underdot';
import { describe, expect, test } from 'vitest';
import { collections } from './index.ts';
import type { CollectionsOptions } from './index.ts';

const hello: HookPage = { sourcePath: 'posts/hello.ejs', outputPath: 'posts/hello/index.html', url: '/posts/hello/', frontmatter: { title: 'Hello' } };

const context: RenderContext = {
  sourcePath: '_archive.ejs',
  variables: {},
  readFile: () => undefined,
  readOutput: () => undefined,
  readBody: (url) => (url === '/posts/hello/' ? '<p>Hello, world.</p>\n' : ''),
  enterFile: () => context,
};

describe('collections', () => {
  test('the plugin is named collections and registers a page hook and the pageBody helper', () => {
    expect(collections({ posts: 'posts' })).toStrictEqual({
      name: 'collections',
      pageHook: expect.any(Function),
      helpers: { pageBody: expect.any(Function) },
    });
  });

  test.each([null, [], 'posts'])('an options value of %j fails', (options) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    expect(() => collections(options as unknown as CollectionsOptions)).toThrow(new Error('The collections must be an object of names to directories.'));
  });

  test.each([42, '', '/posts', 'posts/'])('a directory of %j fails', (directory) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    const options = { posts: directory } as unknown as CollectionsOptions;
    expect(() => collections(options)).toThrow(
      new Error('The directory of posts must be a path under the source root, written without a leading or trailing slash.'),
    );
  });

  test('a call with no options defines nothing', async () => {
    expect(await collections().pageHook!([hello])).toStrictEqual({});
  });

  test('the registered hook collects the pages under each directory', async () => {
    expect(await collections({ posts: 'posts' }).pageHook!([hello])).toStrictEqual({ posts: [{ title: 'Hello', _url: '/posts/hello/' }] });
  });

  test('the registered helper reads a body', () => {
    expect(collections().helpers!.pageBody!(context, '/posts/hello/')).toBe('<p>Hello, world.</p>\n');
  });
});
