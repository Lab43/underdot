// spec: docs/specs/srcset.md

import sharp from 'sharp';
import type { RenderContext } from 'underdot';
import { describe, expect, test, vi } from 'vitest';
import { srcset } from './index.ts';
import type { SrcsetOptions } from './index.ts';

const photo = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 200, g: 100, b: 50 } } }).jpeg().toBuffer();

const emit = vi.fn<RenderContext['emit']>();
const context: RenderContext = {
  sourcePath: 'index.ejs',
  variables: {},
  readFile: () => undefined,
  readOutput: (reference) => (reference === '/images/photo.jpg' ? photo : undefined),
  readBody: () => '',
  enterFile: () => context,
  emit,
};

describe('srcset', () => {
  test('the plugin is named srcset and registers one helper, imageSet', () => {
    expect(srcset()).toStrictEqual({ name: 'srcset', helpers: { imageSet: expect.any(Function) } });
  });

  test('the registered helper renders with the configured presets', () => {
    const plugin = srcset({ presets: { wide: { sizes: '100vw', widths: [300] } } });
    expect(plugin.helpers!.imageSet!(context, '/images/photo.jpg', 'wide', { alt: 'A photo' })).toBe(
      '<img src="/images/photo-300.webp" srcset="/images/photo-300.webp 300w" sizes="100vw" alt="A photo">',
    );
    expect(emit).toHaveBeenCalledOnce();
  });

  test.each([null, [], 'wide'])('a presets value of %j fails', (presets) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    const options = { presets } as unknown as SrcsetOptions;
    expect(() => srcset(options)).toThrow(new Error('The presets option must be an object.'));
  });

  test('a preset the check rejects fails naming it', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    const options = { presets: { wide: { sizes: '100vw', widths: [0] } } } as unknown as SrcsetOptions;
    expect(() => srcset(options)).toThrow(new Error('The preset wide needs widths, a non-empty list of positive integers.'));
  });
});
