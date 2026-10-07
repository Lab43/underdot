// spec: docs/specs/markdown.md

import type { Plugin } from 'underdot';
import { renderMarkdownText } from './render-markdown-text.ts';
import { renderMarkdown } from './render-markdown.ts';

export const markdown = (): Plugin => ({
  name: 'markdown',
  renderers: { md: renderMarkdown },
  helpers: { markdown: renderMarkdownText },
});
