// spec: docs/specs/markdown.md

import { describe, expect, test } from 'vitest';
import { makeRenderContext } from '../../../test/helpers/make-render-context.ts';
import { markdown } from './index.ts';

describe('markdown', () => {
  test('the plugin is named markdown and registers a renderer for md and the markdown helper', () => {
    expect(markdown()).toStrictEqual({
      name: 'markdown',
      renderers: { md: expect.any(Function) },
      helpers: { markdown: expect.any(Function) },
    });
  });

  test('the registered renderer renders a page', async () => {
    expect(await markdown().renderers!.md!('# Welcome\n', makeRenderContext({ sourcePath: 'index.md' }))).toBe('<h1>Welcome</h1>\n');
  });

  test('the registered helper renders a string', () => {
    expect(markdown().helpers!.markdown!(makeRenderContext({ sourcePath: '_.ejs' }), '*short*')).toBe('<p><em>short</em></p>\n');
  });
});
