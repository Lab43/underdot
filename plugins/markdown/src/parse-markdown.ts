// spec: docs/specs/markdown.md

import { Marked } from 'marked';

// An instance of its own, so a site's other use of marked never changes what
// a page renders.
const marked = new Marked();

/**
 * The text rendered as HTML with marked's defaults.
 */
export const parseMarkdown = (text: string): string => marked.parse(text, { async: false });
