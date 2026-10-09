// spec: q-docs/specs/srcset.md

import sharp from 'sharp';
import type { Sharp } from 'sharp';
import type { Producer } from 'underdot';

/**
 * A producer of one derivative: the output at the source path resized to a
 * width, and converted to WebP when asked. A JPEG is turned upright first,
 * since its oriented width is the one the helper measured.
 */
export const produceDerivative = (source: string, width: number, webp: boolean): Producer => async ({ readOutput }) => {
  const bytes = readOutput(source);
  if (bytes === undefined) {
    throw new Error(`No static file's output is at ${source}.`);
  }
  let image: Sharp = sharp(bytes);
  const { format } = await image.metadata();
  if (format === 'jpeg') {
    image = image.autoOrient();
  }
  image = image.resize({ width });
  if (webp) {
    image = image.webp();
  }
  return image.toBuffer();
};
