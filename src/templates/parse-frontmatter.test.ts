// spec: q-docs/specs/templates.md

import * as yaml from 'js-yaml';
import { describe, expect, test, vi } from 'vitest';
import { parseFrontmatter } from './parse-frontmatter.ts';

vi.mock('js-yaml', { spy: true });

describe('parseFrontmatter', () => {
  test('a file with no block has no keys, no directive, and its whole text as body', () => {
    const text = 'Just a body.\n---\nnot: frontmatter\n';
    expect(parseFrontmatter(text)).toStrictEqual({ keys: {}, template: undefined, body: text });
  });

  test('a block yields its keys, and the text after the closing line is the body', () => {
    expect(parseFrontmatter('---\ntitle: Home\ncount: 3\n---\nThe body.\n\nMore body.\n')).toStrictEqual({
      keys: { title: 'Home', count: 3 },
      template: undefined,
      body: 'The body.\n\nMore body.\n',
    });
  });

  test('a block closed on the last line leaves an empty body', () => {
    expect(parseFrontmatter('---\ntitle: Home\n---')).toStrictEqual({ keys: { title: 'Home' }, template: undefined, body: '' });
  });

  test.each([
    ['an empty block', ''],
    ['a block holding only a comment', '# nothing here\n'],
    ['a block holding only blank lines', '\n  \n'],
  ])('%s yields no keys', (_name, block) => {
    expect(parseFrontmatter(`---\n${block}---\nThe body.\n`)).toStrictEqual({ keys: {}, template: undefined, body: 'The body.\n' });
  });

  test('an unquoted date and a date-time are dates, a quoted date is a string, and on is a string', () => {
    const { keys } = parseFrontmatter('---\ndate: 2024-01-02\nat: 2024-01-02T10:00:00Z\nquoted: "2024-01-02"\non: yes\n---\n');
    expect(keys).toStrictEqual({
      date: new Date('2024-01-02T00:00:00Z'),
      at: new Date('2024-01-02T10:00:00Z'),
      quoted: '2024-01-02',
      on: 'yes',
    });
  });

  test('delimiters ending in a carriage return close the block', () => {
    expect(parseFrontmatter('---\r\ntitle: Home\r\n---\r\nThe body.\r\n')).toStrictEqual({
      keys: { title: 'Home' },
      template: undefined,
      body: 'The body.\r\n',
    });
  });

  test('the template key is the directive and not a key', () => {
    expect(parseFrontmatter('---\ntemplate: post\ntitle: Hello\n---\n')).toStrictEqual({
      keys: { title: 'Hello' },
      template: 'post',
      body: '',
    });
  });

  test('a block that never closes fails', () => {
    expect(() => parseFrontmatter('---\ntitle: Home\nThe body.\n')).toThrow(
      new Error('The frontmatter block never closes.'),
    );
  });

  test.each([
    ['a scalar', 'Home'],
    ['a date', '2024-01-02'],
    ['a sequence', '- a\n- b'],
  ])('%s block fails as not a mapping', (_name, block) => {
    expect(() => parseFrontmatter(`---\n${block}\n---\n`)).toThrow(new Error('The frontmatter must be a mapping.'));
  });

  test('a key starting with an underscore fails naming it', () => {
    expect(() => parseFrontmatter('---\ntitle: Home\n_title: Hidden\n---\n')).toThrow(
      new Error('The frontmatter key _title starts with an underscore, which is reserved.'),
    );
  });

  test('a template value that is not a string fails', () => {
    expect(() => parseFrontmatter('---\ntemplate: [a]\n---\n')).toThrow(
      new Error('The template key must be a string.'),
    );
  });

  test("malformed YAML fails with the parser's reason and the line's number in the file", () => {
    expect(() => parseFrontmatter('---\ntitle: Home\n  count: 3\n---\n')).toThrow(
      new Error('The frontmatter is not valid YAML: bad indentation of a mapping entry (line 3).'),
    );
  });

  describe("a failure that is not the parser's own is thrown as it is", () => {
    test.each([
      ['an error of another kind', new Error('The disk failed.')],
      ['a parser exception without a mark', new yaml.YAMLException('unplaced')],
    ])('%s', (_name, failure) => {
      vi.spyOn(yaml, 'loadAll').mockImplementationOnce(() => {
        throw failure;
      });
      expect(() => parseFrontmatter('---\ntitle: Home\n---\n')).toThrow(failure);
    });
  });
});
