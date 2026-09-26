// spec: docs/specs/templates.md

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseFrontmatter } from './parse-frontmatter.ts';

describe('parseFrontmatter', () => {
  test('a file with no block has no keys, no directive, and its whole text as body', () => {
    const text = 'Just a body.\n---\nnot: frontmatter\n';
    assert.deepEqual(parseFrontmatter(text), { keys: {}, template: undefined, body: text });
  });

  test('a block yields its keys, and the text after the closing line is the body', () => {
    assert.deepEqual(parseFrontmatter('---\ntitle: Home\ncount: 3\n---\nThe body.\n\nMore body.\n'), {
      keys: { title: 'Home', count: 3 },
      template: undefined,
      body: 'The body.\n\nMore body.\n',
    });
  });

  test('a block closed on the last line leaves an empty body', () => {
    assert.deepEqual(parseFrontmatter('---\ntitle: Home\n---'), { keys: { title: 'Home' }, template: undefined, body: '' });
  });

  for (const [name, block] of [
    ['an empty block', ''],
    ['a block holding only a comment', '# nothing here\n'],
    ['a block holding only blank lines', '\n  \n'],
  ] as const) {
    test(`${name} yields no keys`, () => {
      assert.deepEqual(parseFrontmatter(`---\n${block}---\nThe body.\n`), { keys: {}, template: undefined, body: 'The body.\n' });
    });
  }

  test('an unquoted date and a date-time are dates, a quoted date is a string, and on is a string', () => {
    const { keys } = parseFrontmatter('---\ndate: 2024-01-02\nat: 2024-01-02T10:00:00Z\nquoted: "2024-01-02"\non: yes\n---\n');
    assert.deepEqual(keys, {
      date: new Date('2024-01-02T00:00:00Z'),
      at: new Date('2024-01-02T10:00:00Z'),
      quoted: '2024-01-02',
      on: 'yes',
    });
  });

  test('delimiters ending in a carriage return close the block', () => {
    assert.deepEqual(parseFrontmatter('---\r\ntitle: Home\r\n---\r\nThe body.\r\n'), {
      keys: { title: 'Home' },
      template: undefined,
      body: 'The body.\r\n',
    });
  });

  test('the template key is the directive and not a key', () => {
    assert.deepEqual(parseFrontmatter('---\ntemplate: post\ntitle: Hello\n---\n'), {
      keys: { title: 'Hello' },
      template: 'post',
      body: '',
    });
  });

  test('a block that never closes fails', () => {
    assert.throws(() => parseFrontmatter('---\ntitle: Home\nThe body.\n'), {
      message: 'The frontmatter block never closes.',
    });
  });

  for (const [name, block] of [['a scalar', 'Home'], ['a date', '2024-01-02'], ['a sequence', '- a\n- b']] as const) {
    test(`${name} block fails as not a mapping`, () => {
      assert.throws(() => parseFrontmatter(`---\n${block}\n---\n`), { message: 'The frontmatter must be a mapping.' });
    });
  }

  test('a key starting with an underscore fails naming it', () => {
    assert.throws(() => parseFrontmatter('---\ntitle: Home\n_title: Hidden\n---\n'), {
      message: 'The frontmatter key _title starts with an underscore, which is reserved.',
    });
  });

  test('a template value that is not a string fails', () => {
    assert.throws(() => parseFrontmatter('---\ntemplate: [a]\n---\n'), { message: 'The template key must be a string.' });
  });

  test("malformed YAML fails with the parser's reason and the line's number in the file", () => {
    assert.throws(() => parseFrontmatter('---\ntitle: Home\n  count: 3\n---\n'), {
      message: 'The frontmatter is not valid YAML: bad indentation of a mapping entry (line 3).',
    });
  });
});
