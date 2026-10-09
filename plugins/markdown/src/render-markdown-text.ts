// spec: q-docs/specs/markdown.md

import type { RenderContext } from 'underdot';
import { parseMarkdown } from './parse-markdown.ts';

/**
 * The text rendered as a block of HTML, as a page's body is.
 */
export const renderMarkdownText = (_context: RenderContext, text: unknown): string => {
  if (typeof text !== 'string') {
    throw new Error(`The text must be a string, and ${String(text)} is not.`);
  }
  return parseMarkdown(text);
};
