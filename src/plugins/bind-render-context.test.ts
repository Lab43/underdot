// spec: docs/specs/plugins.md, Render context

import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { bindRenderContext } from './bind-render-context.ts';

const source = join(fixturePath('templated'), 'source');

// The walked files a read may reach. notes.txt is on disk but left out, as an
// excluded file would be.
const sourcePaths = new Set(['_.tpl', '_includes/header.tpl', '_partial.txt', 'about.tpl', 'blog/_.tpl', 'blog/_post.tpl', 'blog/hello.tpl', 'index.tpl']);

const bodies = new Map([['/', 'The home body.'], ['/blog/hello/', 'The hello body.']]);

const variables = { title: 'Home' };

// The context of a template, which may read bodies, and of a page, which may not.
const makeContext = (sourcePath: string) => bindRenderContext(source, sourcePaths)(sourcePath, variables, bodies);
const makePageContext = (sourcePath: string) => bindRenderContext(source, sourcePaths)(sourcePath, variables, undefined);

describe('bindRenderContext', () => {
  test('the context carries the file and its variables', () => {
    expect(makeContext('index.tpl')).toMatchObject({ sourcePath: 'index.tpl', variables: { title: 'Home' } });
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
