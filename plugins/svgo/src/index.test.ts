// spec: docs/specs/svgo.md

import { describe, expect, test } from 'vitest';
import { makeHandlerContext } from '../../../test/helpers/make-handler-context.ts';
import { makeRenderContext } from '../../../test/helpers/make-render-context.ts';
import { svgo } from './index.ts';
import type { SvgoOptions } from './index.ts';

const icon = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" version="1.1">',
  '  <title>Mail</title>',
  '  <path d="M2,4 L22,4 L22,20 L2,20 Z"></path>',
  '</svg>',
  '',
].join('\n');

const optimizedIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><title>Mail</title><path d="M2 4h20v16H2Z"/></svg>';

// An icon styled by its own stylesheet, which the default keeps and prefixes.
const styledIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>.a { fill: red; }</style><path class="a" d="M2 4h20v16H2Z"/></svg>';

const context = makeRenderContext({
  sourcePath: 'index.ejs',
  readOutput: (reference) => (reference === '/_icons/mail.svg' ? Buffer.from(optimizedIcon) : undefined),
});

// The icon through the handler the plugin registers, awaited because a
// registered handler may return a promise.
const handle = (options?: SvgoOptions) => svgo(options).handlers!['**/*.svg']!({ outputPath: '_icons/mail.svg', contents: Buffer.from(icon) }, makeHandlerContext());

describe('svgo', () => {
  test('the plugin is named svgo and registers a handler for every SVG and the inlineSvg helper', () => {
    expect(svgo()).toStrictEqual({
      name: 'svgo',
      handlers: { '**/*.svg': expect.any(Function) },
      helpers: { inlineSvg: expect.any(Function) },
    });
  });

  test('the registered handler optimizes with the default list', async () => {
    expect(await handle()).toStrictEqual([{ outputPath: '_icons/mail.svg', contents: optimizedIcon }]);
  });

  test('the default keeps a stylesheet and prefixes its classes with the file name', async () => {
    const [output] = await svgo().handlers!['**/*.svg']!({ outputPath: '_icons/mail.svg', contents: Buffer.from(styledIcon) }, makeHandlerContext());
    expect(output!.contents).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>.mail_svg__a{fill:red}</style><path d="M2 4h20v16H2Z" class="mail_svg__a"/></svg>',
    );
  });

  test('the registered helper inlines an output', () => {
    expect(svgo().helpers!.inlineSvg!(context, '/_icons/mail.svg')).toBe(optimizedIcon);
  });

  test('a plugins value that is not an array fails', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    const options = { plugins: 'preset-default' } as unknown as SvgoOptions;
    expect(() => svgo(options)).toThrow(new Error('The plugins option must be an array.'));
  });

  test.each([42, null, {}, { name: 1 }])('a plugins entry of %j fails', (entry) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    const options = { plugins: [entry] } as unknown as SvgoOptions;
    expect(() => svgo(options)).toThrow(new Error('Each plugins entry must be a plugin name or an object with a name.'));
  });

  test('a plugin name svgo does not know fails at the factory call', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    const options = { plugins: ['nope'] } as unknown as SvgoOptions;
    expect(() => svgo(options)).toThrow('Unknown builtin plugin "nope" specified.');
  });

  test('the plugin list replaces the default', async () => {
    const [output] = await handle({ plugins: ['preset-default', 'removeDimensions'] });
    expect(output!.contents).not.toContain('width');
  });
});
