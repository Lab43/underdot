// spec: q-docs/specs/srcset.md

import { imageSize } from 'image-size';
import sharp from 'sharp';
import type { RenderContext } from 'underdot';
import { describe, expect, test, vi } from 'vitest';
import { makeRenderContext } from '../../../test/helpers/make-render-context.ts';
import type { Sizing } from './check-sizing.ts';
import { renderImageSet } from './render-image-set.ts';

// A solid 1200 by 800 image in the format given, tagged with an EXIF
// orientation when one is given.
const makeImage = (format: 'jpeg' | 'png' | 'webp' | 'gif' | 'avif', orientation?: number): Promise<Buffer> => {
  const image = sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 200, g: 100, b: 50 } } }).toFormat(format);
  return (orientation === undefined ? image : image.withMetadata({ orientation })).toBuffer();
};

vi.mock('image-size', { spy: true });

const jpeg = await makeImage('jpeg');

// The outputs by the reference as written.
const outputs = new Map<string, Buffer>([
  ['/images/photo.jpg', jpeg],
  ['/_images/photo.jpg', jpeg],
  ['photo.jpg', jpeg],
  ['/images/bare', jpeg],
  ['/images/logo.png', await makeImage('png')],
  ['/images/photo.webp', await makeImage('webp')],
  ['/images/still.gif', await makeImage('gif')],
  ['/images/still.avif', await makeImage('avif')],
  ['/images/portrait.jpg', await makeImage('jpeg', 6)],
  ['/images/icon.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>')],
  ['/notes.txt', Buffer.from('Not an image.\n')],
]);

// The context as the spec defines it to a helper, rendering a page in the
// about directory, with a read of handled output answering from the map and
// an emit that records what it is given.
const makeContext = () => {
  const emit = vi.fn<RenderContext['emit']>();
  const context = makeRenderContext({
    sourcePath: 'about/index.ejs',
    readOutput: (reference) => outputs.get(reference),
    emit,
  });
  return { context, emit };
};

const presets: Record<string, Sizing> = {
  wide: { sizes: '100vw', widths: [300, 1200, 1600], webp: false },
  hero: { sizes: '(min-width: 600px) 600px, 100vw', widths: [300, 1600] },
};

const render = (reference: unknown, sizing: unknown, attributes?: unknown): string => renderImageSet(makeContext().context, presets, reference, sizing, attributes);

describe('renderImageSet', () => {
  test('a public JPEG under a preset keeping its format offers a derivative per width below its own, then itself in place of the rest', () => {
    expect(render('/images/photo.jpg', 'wide')).toBe('<img src="/images/photo.jpg" srcset="/images/photo-300.jpg 300w, /images/photo.jpg 1200w" sizes="100vw">');
  });

  test('a width equal to the image\'s own is answered by the image, and widths all below it need no stand-in', () => {
    expect(render('/images/photo.jpg', { sizes: '50vw', widths: [1200], webp: false })).toBe('<img src="/images/photo.jpg" srcset="/images/photo.jpg 1200w" sizes="50vw">');
    expect(render('/images/photo.jpg', { sizes: '50vw', widths: [300, 600], webp: false })).toBe(
      '<img src="/images/photo-600.jpg" srcset="/images/photo-300.jpg 300w, /images/photo-600.jpg 600w" sizes="50vw">',
    );
  });

  test('a private original ships as derivatives alone, at the path with the underscore removed, its full width included', () => {
    const { context, emit } = makeContext();
    expect(renderImageSet(context, presets, '/_images/photo.jpg', 'wide')).toBe(
      '<img src="/images/photo.jpg" srcset="/images/photo-300.jpg 300w, /images/photo.jpg 1200w" sizes="100vw">',
    );
    expect(emit.mock.calls).toStrictEqual([
      ['images/photo-300.jpg', { source: '_images/photo.jpg', width: 300, webp: false }, expect.any(Function)],
      ['images/photo.jpg', { source: '_images/photo.jpg', width: 1200, webp: false }, expect.any(Function)],
    ]);
  });

  test('a converting preset emits WebP derivatives, a full-width one for a public original included', () => {
    const { context, emit } = makeContext();
    expect(renderImageSet(context, presets, '/images/photo.jpg', 'hero')).toBe(
      '<img src="/images/photo.webp" srcset="/images/photo-300.webp 300w, /images/photo.webp 1200w" sizes="(min-width: 600px) 600px, 100vw">',
    );
    expect(emit.mock.calls).toStrictEqual([
      ['images/photo-300.webp', { source: 'images/photo.jpg', width: 300, webp: true }, expect.any(Function)],
      ['images/photo.webp', { source: 'images/photo.jpg', width: 1200, webp: true }, expect.any(Function)],
    ]);
  });

  test('a public WebP under a converting preset is never converted and serves itself as the largest', () => {
    const { context, emit } = makeContext();
    expect(renderImageSet(context, presets, '/images/photo.webp', 'hero')).toBe(
      '<img src="/images/photo.webp" srcset="/images/photo-300.webp 300w, /images/photo.webp 1200w" sizes="(min-width: 600px) 600px, 100vw">',
    );
    expect(emit.mock.calls).toStrictEqual([['images/photo-300.webp', { source: 'images/photo.webp', width: 300, webp: false }, expect.any(Function)]]);
  });

  test('a GIF converts under the default and keeps its format under webp false', () => {
    expect(render('/images/still.gif', { sizes: '100vw', widths: [300] })).toBe('<img src="/images/still-300.webp" srcset="/images/still-300.webp 300w" sizes="100vw">');
    expect(render('/images/still.gif', { sizes: '100vw', widths: [300], webp: false })).toBe('<img src="/images/still-300.gif" srcset="/images/still-300.gif 300w" sizes="100vw">');
  });

  test('an AVIF converts under the default and keeps its format under webp false', () => {
    expect(render('/images/still.avif', { sizes: '100vw', widths: [300] })).toBe('<img src="/images/still-300.webp" srcset="/images/still-300.webp 300w" sizes="100vw">');
    expect(render('/images/still.avif', { sizes: '100vw', widths: [300], webp: false })).toBe('<img src="/images/still-300.avif" srcset="/images/still-300.avif 300w" sizes="100vw">');
  });

  test('a PNG resizes like any other source', () => {
    expect(render('/images/logo.png', { sizes: '100vw', widths: [300], webp: false })).toBe('<img src="/images/logo-300.png" srcset="/images/logo-300.png 300w" sizes="100vw">');
  });

  test('a JPEG tagged orientation 6 is measured by its upright width', () => {
    expect(render('/images/portrait.jpg', { sizes: '100vw', widths: [300, 800] })).toBe(
      '<img src="/images/portrait.webp" srcset="/images/portrait-300.webp 300w, /images/portrait.webp 800w" sizes="100vw">',
    );
  });

  test('an orientation reported for any format but a JPEG is ignored, so the stored width decides', () => {
    vi.mocked(imageSize).mockReturnValueOnce({ width: 1200, height: 800, type: 'png', orientation: 6 });
    expect(render('/images/logo.png', { sizes: '100vw', widths: [1000], webp: false })).toBe('<img src="/images/logo-1000.png" srcset="/images/logo-1000.png 1000w" sizes="100vw">');
  });

  test("a relative reference resolves against the file's directory", () => {
    const { context, emit } = makeContext();
    expect(renderImageSet(context, presets, 'photo.jpg', { sizes: '100vw', widths: [300] })).toBe('<img src="/about/photo-300.webp" srcset="/about/photo-300.webp 300w" sizes="100vw">');
    expect(emit).toHaveBeenCalledExactlyOnceWith('about/photo-300.webp', { source: 'about/photo.jpg', width: 300, webp: true }, expect.any(Function));
  });

  test('an output path with no extension gives its derivatives none, unless they convert', () => {
    expect(render('/images/bare', 'wide')).toBe('<img src="/images/bare" srcset="/images/bare-300 300w, /images/bare 1200w" sizes="100vw">');
    expect(render('/images/bare', { sizes: '100vw', widths: [300] })).toBe('<img src="/images/bare-300.webp" srcset="/images/bare-300.webp 300w" sizes="100vw">');
  });

  test('duplicate widths are offered once, in ascending order', () => {
    expect(render('/images/photo.jpg', { sizes: '100vw', widths: [600, 300, 600], webp: false })).toBe(
      '<img src="/images/photo-600.jpg" srcset="/images/photo-300.jpg 300w, /images/photo-600.jpg 600w" sizes="100vw">',
    );
  });

  test('the given attributes follow the element\'s own in the order given, every value escaped and a false one omitted', () => {
    expect(render('/images/photo.jpg', { sizes: '"wide" & <tall>', widths: [300], webp: false }, { alt: 'A "quoted" <b> & more', class: false, loading: 'lazy' })).toBe(
      '<img src="/images/photo-300.jpg" srcset="/images/photo-300.jpg 300w" sizes="&quot;wide&quot; &amp; &lt;tall&gt;" alt="A &quot;quoted&quot; &lt;b&gt; &amp; more" loading="lazy">',
    );
  });

  test('the producer emitted resizes the output it names', async () => {
    const { context, emit } = makeContext();
    renderImageSet(context, presets, '/images/photo.jpg', { sizes: '100vw', widths: [300] });
    const produce = emit.mock.calls[0]![2];
    const contents = await produce({
      readOutput: (outputPath) => (outputPath === 'images/photo.jpg' ? jpeg : undefined),
      warn: vi.fn(),
    });
    expect(await sharp(contents).metadata()).toMatchObject({ format: 'webp', width: 300, height: 200 });
  });

  describe('errors', () => {
    test.each([
      ['a reference that is not a string', 7, 'wide', {}, 'A reference must be a string, and 7 is not.'],
      ['a sizing that is neither a name nor an object', '/images/photo.jpg', 300, {}, "A sizing must be a preset's name or an object, and 300 is not."],
      ['a sizing of null', '/images/photo.jpg', null, {}, "A sizing must be a preset's name or an object, and null is not."],
      ['a name no preset has', '/images/photo.jpg', 'thumb', {}, 'No preset is named thumb.'],
      ['a name only the prototype has', '/images/photo.jpg', 'toString', {}, 'No preset is named toString.'],
      ['a passed sizing checkSizing rejects', '/images/photo.jpg', { sizes: '100vw', widths: [] }, {}, 'The sizing passed to imageSet needs widths, a non-empty list of positive integers.'],
      ['attributes that are not an object', '/images/photo.jpg', 'wide', 'lazy', 'The attributes must be an object, and lazy is not.'],
      ['attributes that are a list', '/images/photo.jpg', 'wide', ['lazy'], 'The attributes must be an object, and lazy is not.'],
      ['attributes carrying src', '/images/photo.jpg', 'wide', { src: '/x.jpg' }, 'The attributes must not carry src, which the image already has.'],
      ['attributes carrying srcset', '/images/photo.jpg', 'wide', { srcset: '' }, 'The attributes must not carry srcset, which the image already has.'],
      ['attributes carrying sizes', '/images/photo.jpg', 'wide', { sizes: '' }, 'The attributes must not carry sizes, which the image already has.'],
      ['an attribute that is neither a string nor false', '/images/photo.jpg', 'wide', { width: 300 }, 'The attribute width must be a string or false, and 300 is not.'],
      ['an attribute that is true', '/images/photo.jpg', 'wide', { hidden: true }, 'The attribute hidden must be a string or false, and true is not.'],
      ['a reference no output is at', '/images/missing.jpg', 'wide', {}, "No static file's output is at /images/missing.jpg."],
      ['an SVG', '/images/icon.svg', 'wide', {}, '/images/icon.svg is a svg image, which the helper does not resize.'],
    ])('%s fails', (_name, reference, sizing, attributes, message) => {
      expect(() => render(reference, sizing, attributes)).toThrow(new Error(message));
    });

    test('bytes the reader cannot size fail with its message', () => {
      expect(() => render('/notes.txt', 'wide')).toThrow(/^\/notes\.txt is not an image the helper can size: .+/);
    });

    test('a throw from the reader that is not an Error is printed as it is', () => {
      vi.mocked(imageSize).mockImplementationOnce(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- what a dependency may throw
        throw 'garbled';
      });
      expect(() => render('/images/photo.jpg', 'wide')).toThrow(new Error('/images/photo.jpg is not an image the helper can size: garbled'));
    });
  });
});
