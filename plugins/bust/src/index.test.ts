// spec: docs/specs/bust.md

import { describe, expect, test } from 'vitest';
import { makeRenderContext } from '../../../test/helpers/make-render-context.ts';
import { bust } from './index.ts';

const context = makeRenderContext({
  sourcePath: 'index.ejs',
  readOutput: (reference) => (reference === '/styles/site.css' ? Buffer.from('body { margin: 0; }\n') : undefined),
});

describe('bust', () => {
  test('the plugin is named bust and registers one helper, bust', () => {
    expect(bust()).toStrictEqual({ name: 'bust', helpers: { bust: expect.any(Function) } });
  });

  test('the registered helper busts a reference', () => {
    expect(bust().helpers!.bust!(context, '/styles/site.css')).toBe('/styles/site.css?v=eac0e790');
  });
});
