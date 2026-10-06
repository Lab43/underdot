// spec: docs/specs/collections.md

import type { RenderContext } from 'underdot';
import { describe, expect, test, vi } from 'vitest';
import { readPageBody } from './read-page-body.ts';

// The context as the spec defines it to a helper, with a read of a rendered
// body answering from a map by the URL as written.
const makeContext = (bodies: Record<string, string>) => {
  const readBody = vi.fn((url: string): string => {
    const body = bodies[url];
    if (body === undefined) {
      throw new Error(`_archive.ejs reads the body of ${url}, but no page has that URL.`);
    }
    return body;
  });
  const context: RenderContext = {
    sourcePath: '_archive.ejs',
    variables: {},
    readFile: () => undefined,
    readOutput: () => undefined,
    readBody,
    enterFile: () => context,
  };
  return { context, readBody };
};

describe('readPageBody', () => {
  test('a URL a page has returns its body, read as written', () => {
    const { context, readBody } = makeContext({ '/posts/hello/': '<p>Hello, world.</p>\n' });
    expect(readPageBody(context, '/posts/hello/')).toBe('<p>Hello, world.</p>\n');
    expect(readBody).toHaveBeenCalledExactlyOnceWith('/posts/hello/');
  });

  test('a URL that is not a string fails before anything is read', () => {
    const { context, readBody } = makeContext({});
    expect(() => readPageBody(context, 42)).toThrow(new Error('The URL must be a string, and 42 is not.'));
    expect(readBody).not.toHaveBeenCalled();
  });

  test("the context's own error propagates as it is", () => {
    const { context } = makeContext({});
    expect(() => readPageBody(context, '/posts/nope/')).toThrow(new Error('_archive.ejs reads the body of /posts/nope/, but no page has that URL.'));
  });
});
