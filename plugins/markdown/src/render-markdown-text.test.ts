// spec: q-docs/specs/markdown.md

import { describe, expect, test } from 'vitest';
import { makeRenderContext } from '../../../test/helpers/make-render-context.ts';
import { renderMarkdownText } from './render-markdown-text.ts';

const context = makeRenderContext({ sourcePath: '_.ejs' });

describe('renderMarkdownText', () => {
  test('a string renders as a block of HTML', () => {
    expect(renderMarkdownText(context, 'A *short* note on [Underdot](https://github.com/Lab43/underdot).')).toBe(
      '<p>A <em>short</em> note on <a href="https://github.com/Lab43/underdot">Underdot</a>.</p>\n',
    );
  });

  test.each([undefined, 42, null])('a text of %s fails', (text) => {
    expect(() => renderMarkdownText(context, text)).toThrow(new Error(`The text must be a string, and ${String(text)} is not.`));
  });
});
