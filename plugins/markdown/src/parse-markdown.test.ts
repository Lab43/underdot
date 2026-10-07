// spec: docs/specs/markdown.md

import { describe, expect, test } from 'vitest';
import { parseMarkdown } from './parse-markdown.ts';

// A body using each GitHub Flavored Markdown feature the spec names, and a
// raw HTML block.
const body = [
  '# Welcome',
  '',
  'Markdown with **strong** text, ~~struck~~ text, and a link to https://example.com.',
  '',
  '| Plugin | Renders |',
  '| --- | --- |',
  '| ejs | `.ejs` |',
  '| markdown | `.md` |',
  '',
  '<aside class="note">Raw HTML passes through.</aside>',
  '',
].join('\n');

const renderedBody = [
  '<h1>Welcome</h1>',
  '<p>Markdown with <strong>strong</strong> text, <del>struck</del> text, and a link to <a href="https://example.com">https://example.com</a>.</p>',
  '<table>',
  '<thead>',
  '<tr>',
  '<th>Plugin</th>',
  '<th>Renders</th>',
  '</tr>',
  '</thead>',
  '<tbody><tr>',
  '<td>ejs</td>',
  '<td><code>.ejs</code></td>',
  '</tr>',
  '<tr>',
  '<td>markdown</td>',
  '<td><code>.md</code></td>',
  '</tr>',
  '</tbody></table>',
  '<aside class="note">Raw HTML passes through.</aside>',
  '',
].join('\n');

describe('parseMarkdown', () => {
  test('a body renders as GitHub Flavored Markdown, with raw HTML as written and no heading id', () => {
    expect(parseMarkdown(body)).toBe(renderedBody);
  });

  test('a line of text renders as a paragraph ending with a newline', () => {
    expect(parseMarkdown('A *short* note on [Underdot](https://github.com/Lab43/underdot).')).toBe(
      '<p>A <em>short</em> note on <a href="https://github.com/Lab43/underdot">Underdot</a>.</p>\n',
    );
  });

  test('an email autolink is a readable mailto link', () => {
    expect(parseMarkdown('<a@b.com>')).toBe('<p><a href="mailto:a@b.com">a@b.com</a></p>\n');
  });

  test('the empty string renders to the empty string', () => {
    expect(parseMarkdown('')).toBe('');
  });
});
