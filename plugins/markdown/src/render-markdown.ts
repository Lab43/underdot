// spec: docs/specs/markdown.md

import { basename } from 'node:path/posix';
import type { RenderContext } from 'underdot';
import { parseMarkdown } from './parse-markdown.ts';

/**
 * The renderer for `.md`: the body rendered as HTML, for a page only.
 */
export const renderMarkdown = (body: string, context: RenderContext): string => {
  if (basename(context.sourcePath).startsWith('_')) {
    throw new Error('A Markdown file cannot be a template, because Markdown has no way to place _content.');
  }
  return parseMarkdown(body);
};
