// spec: q-docs/specs/ejs.md

import type { RenderContext } from 'underdot';
import { describe, expect, test } from 'vitest';
import { makeRenderContext } from '../../../test/helpers/make-render-context.ts';
import { ejs } from './index.ts';
import type { EjsOptions } from './index.ts';

const makeContext = (sourcePath: string, variables: Record<string, unknown>): RenderContext => makeRenderContext({
  sourcePath,
  variables,
  readFile: (reference) => (reference === '/_includes/head.ejs' ? 'the head' : undefined),
  enterFile: (reference, entered) => makeContext(reference.slice(1), entered),
});

const context = makeContext('index.ejs', {});

// A render through the renderer the plugin registers.
const render = (body: string, options?: EjsOptions) => ejs(options).renderers!.ejs!(body, context);

describe('ejs', () => {
  test('the plugin is named ejs and registers one renderer, for ejs', () => {
    expect(ejs()).toStrictEqual({ name: 'ejs', renderers: { ejs: expect.any(Function) } });
  });

  test('views defaults to none, so an include by name finds nothing', () => {
    expect(() => render("<%- include('head') %>")).toThrow('No include head is in the source root or in the views directories.');
  });

  test('a views value that is not an array fails', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    const options = { views: '_includes' } as unknown as EjsOptions;
    expect(() => ejs(options)).toThrow(new Error('The views option must be an array.'));
  });

  test.each([42, '', '/_includes'])('a views entry of %j fails', (entry) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    const options = { views: [entry] } as unknown as EjsOptions;
    expect(() => ejs(options)).toThrow(
      new Error('Each views entry must be a directory path under the source root, written without a leading slash.'),
    );
  });

  test('the registered renderer resolves an include through a views directory', () => {
    expect(render("<%- include('head') %>", { views: ['_includes'] })).toBe('the head');
  });
});
