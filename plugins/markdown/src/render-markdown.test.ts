// spec: docs/specs/markdown.md

import { describe, expect, test } from 'vitest';
import { makeRenderContext } from '../../../test/helpers/make-render-context.ts';
import { renderMarkdown } from './render-markdown.ts';

describe('renderMarkdown', () => {
  test.each(['index.md', 'blog/post.md'])('a page at %s renders its body', (sourcePath) => {
    expect(renderMarkdown('# Welcome\n', makeRenderContext({ sourcePath }))).toBe('<h1>Welcome</h1>\n');
  });

  test.each(['_.md', 'blog/_post.md'])('a template at %s fails', (sourcePath) => {
    expect(() => renderMarkdown('# Welcome\n', makeRenderContext({ sourcePath }))).toThrow(
      new Error('A Markdown file cannot be a template, because Markdown has no way to place _content.'),
    );
  });
});
