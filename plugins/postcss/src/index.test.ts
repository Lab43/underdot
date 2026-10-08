// spec: docs/specs/postcss.md

import { join } from 'node:path';
import type { AcceptedPlugin } from 'postcss';
import { describe, expect, test } from 'vitest';
import { fixturePath } from '../../../test/helpers/fixture-path.ts';
import { makeHandlerContext } from '../../../test/helpers/make-handler-context.ts';
import { postcss } from './index.ts';
import type { PostcssOptions } from './index.ts';

// Renames every rule's selector, so the output shows the plugin ran.
const renameRules: AcceptedPlugin = {
  postcssPlugin: 'rename-rules',
  Rule: (rule) => {
    rule.selector = '.renamed';
  },
};

describe('postcss', () => {
  test('the plugin is named postcss and registers a handler for every CSS file', () => {
    expect(postcss({ plugins: [renameRules] })).toStrictEqual({ name: 'postcss', handlers: { '**/*.css': expect.any(Function) } });
  });

  test.each([
    ['missing', undefined],
    ['not an array', { plugins: renameRules }],
    ['empty', { plugins: [] }],
  ])('a plugins option that is %s fails', (_case, options) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    expect(() => postcss(options as unknown as PostcssOptions)).toThrow(new Error('The plugins option must be an array of at least one PostCSS plugin.'));
  });

  test("an entry that is not a plugin fails at the factory call with PostCSS's message", () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    const options = { plugins: ['autoprefixer'] } as unknown as PostcssOptions;
    expect(() => postcss(options)).toThrow(new Error('autoprefixer is not a PostCSS plugin'));
  });

  test('the registered handler runs the file through the plugins given', async () => {
    const handler = postcss({ plugins: [renameRules] }).handlers!['**/*.css']!;
    await expect(handler({ outputPath: 'site.css', contents: Buffer.from('a {\n  color: red;\n}\n') }, makeHandlerContext({ sourceDirectory: join(fixturePath('postcss'), 'source') }))).resolves.toStrictEqual([
      { outputPath: 'site.css', contents: '.renamed {\n  color: red;\n}\n' },
    ]);
  });
});
