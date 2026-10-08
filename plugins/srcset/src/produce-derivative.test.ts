// spec: docs/specs/srcset.md

import sharp from 'sharp';
import { describe, expect, test, vi } from 'vitest';
import { produceDerivative } from './produce-derivative.ts';

// A solid image of the size given, in the format given, tagged with an EXIF
// orientation when one is given.
const makeImage = async (width: number, height: number, format: 'jpeg' | 'png', orientation?: number): Promise<Buffer> => {
  let image = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } } }).toFormat(format);
  if (orientation !== undefined) {
    image = image.withMetadata({ orientation });
  }
  return image.toBuffer();
};

// The producer run with the source at `images/photo`, and what sharp reads of its result.
const produce = async (bytes: Buffer, width: number, webp: boolean) => {
  const contents = await produceDerivative('images/photo', width, webp)({
    readOutput: (outputPath) => (outputPath === 'images/photo' ? bytes : undefined),
    warn: vi.fn(),
  });
  const { format, width: producedWidth, height, orientation } = await sharp(contents).metadata();
  return { format, width: producedWidth, height, orientation };
};

describe('produceDerivative', () => {
  test.each([
    ['a JPEG', 'jpeg', false, 'jpeg'],
    ['a JPEG', 'jpeg', true, 'webp'],
    ['a PNG', 'png', false, 'png'],
    ['a PNG', 'png', true, 'webp'],
  ] as const)('%s resized to a width keeps its proportions, converted when webp is %s, as %s', async (_name, format, webp, producedFormat) => {
    const bytes = await makeImage(1200, 800, format);
    expect(await produce(bytes, 300, webp)).toStrictEqual({ format: producedFormat, width: 300, height: 200, orientation: undefined });
  });

  test('a JPEG tagged orientation 6 is turned upright before it is resized, and the tag is dropped', async () => {
    const bytes = await makeImage(1200, 800, 'jpeg', 6);
    expect(await produce(bytes, 400, true)).toStrictEqual({ format: 'webp', width: 400, height: 600, orientation: undefined });
  });

  test('a PNG tagged orientation 6 is resized as it is stored', async () => {
    const bytes = await makeImage(1200, 800, 'png', 6);
    expect((await sharp(bytes).metadata()).orientation).toBe(6);
    expect(await produce(bytes, 400, false)).toMatchObject({ format: 'png', width: 400, height: 267 });
  });

  test('a source no output is at fails naming it', async () => {
    await expect(produceDerivative('images/missing.jpg', 300, true)({ readOutput: () => undefined, warn: vi.fn() })).rejects.toThrow(
      new Error("No static file's output is at images/missing.jpg."),
    );
  });
});
