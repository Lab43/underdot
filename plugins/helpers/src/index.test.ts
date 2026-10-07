// spec: docs/specs/helpers.md

import { describe, expect, test } from 'vitest';
import { makeRenderContext } from '../../../test/helpers/make-render-context.ts';
import { helpers } from './index.ts';

const context = makeRenderContext({
  sourcePath: 'index.ejs',
  variables: { _url: '/' },
  readOutput: (reference) => (reference === '/styles/site.css' ? Buffer.from('body { margin: 0; }\n') : undefined),
});

describe('helpers', () => {
  test('the plugin is named helpers and registers activeLink, formatDate, and fileExists', () => {
    expect(helpers()).toStrictEqual({
      name: 'helpers',
      helpers: { activeLink: expect.any(Function), formatDate: expect.any(Function), fileExists: expect.any(Function) },
    });
  });

  test('activeLink renders a link', () => {
    expect(helpers().helpers!.activeLink!(context, '/', 'Home')).toBe('<a href="/" class="active">Home</a>');
  });

  test('formatDate prints a date', () => {
    expect(helpers().helpers!.formatDate!(context, new Date('2024-01-02T00:00:00.000Z'), 'yyyy-MM-dd')).toBe('2024-01-02');
  });

  test('fileExists answers for an output', () => {
    expect(helpers().helpers!.fileExists!(context, '/styles/site.css')).toBe(true);
  });
});
