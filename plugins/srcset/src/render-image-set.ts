// spec: docs/specs/srcset.md

import { dirname, join } from 'node:path/posix';
import { imageSize } from 'image-size';
import type { RenderContext } from 'underdot';
import { checkPreset } from './check-preset.ts';
import type { Preset } from './check-preset.ts';
import { produceDerivative } from './produce-derivative.ts';

// The formats sharp resizes to the width the header states.
const resizableTypes = new Set(['jpg', 'png', 'webp', 'gif', 'avif']);

// The attributes the element sets itself.
const ownAttributes = new Set(['src', 'srcset', 'sizes']);

/**
 * An `<img>` offering a static file's output at each width of a preset it
 * can fill, emitting a derivative for each, with the given attributes after
 * the element's own.
 */
export const renderImageSet = (
  context: RenderContext,
  presets: Record<string, Preset>,
  reference: unknown,
  preset: unknown,
  attributes: unknown = {},
): string => {
  if (typeof reference !== 'string') {
    throw new Error(`A reference must be a string, and ${String(reference)} is not.`);
  }
  let chosen: Preset;
  if (typeof preset === 'string') {
    const named = Object.hasOwn(presets, preset) ? presets[preset] : undefined;
    if (named === undefined) {
      throw new Error(`No preset is named ${preset}.`);
    }
    chosen = named;
  } else if (typeof preset === 'object' && preset !== null) {
    checkPreset(preset, 'The inline preset');
    chosen = preset;
  } else {
    throw new Error(`A preset must be a name or an object, and ${String(preset)} is not.`);
  }
  if (typeof attributes !== 'object' || attributes === null || Array.isArray(attributes)) {
    throw new Error(`The attributes must be an object, and ${String(attributes)} is not.`);
  }
  const given: [string, unknown][] = Object.entries(attributes);
  for (const [name, value] of given) {
    if (ownAttributes.has(name)) {
      throw new Error(`The attributes must not carry ${name}, which the image already has.`);
    }
    if (typeof value !== 'string' && value !== false) {
      throw new Error(`The attribute ${name} must be a string or false, and ${String(value)} is not.`);
    }
  }

  // Resolved as the context resolves a read, which also normalizes it.
  const outputPath = join(reference.startsWith('/') ? '.' : dirname(context.sourcePath), reference);
  const bytes = context.readOutput(reference);
  if (bytes === undefined) {
    throw new Error(`No static file's output is at ${reference}.`);
  }
  let size: ReturnType<typeof imageSize>;
  try {
    size = imageSize(bytes);
  } catch (error) {
    throw new Error(`${reference} is not an image the helper can size: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  if (size.type === undefined || !resizableTypes.has(size.type)) {
    throw new Error(`${reference} is a ${String(size.type)} image, which the helper does not resize.`);
  }
  // Orientations 5 through 8 turn the image a quarter, so it stands as wide
  // as it is stored high. Only a JPEG's is applied, since the producer turns
  // only a JPEG upright, and the two must agree on the width.
  const isTurned = size.type === 'jpg' && (size.orientation ?? 1) >= 5;
  const width = isTurned ? size.height : size.width;

  // A derivative drops one leading underscore from each segment, so a private
  // original's derivatives are public, and drops the extension. A WebP source
  // is never converted, since it is WebP already.
  const segments = outputPath.split('/');
  const isPrivate = segments.some((segment) => segment.startsWith('_'));
  const convert = chosen.webp !== false && size.type !== 'webp';
  const publicPath = segments.map((segment) => (segment.startsWith('_') ? segment.slice(1) : segment)).join('/');
  const extensionMatch = /\.[^./]*$/.exec(publicPath);
  const base = extensionMatch === null ? publicPath : publicPath.slice(0, extensionMatch.index);
  const extension = convert ? '.webp' : (extensionMatch?.[0] ?? '');

  const emitDerivative = (derivativePath: string, derivativeWidth: number): void => {
    context.emit(derivativePath, { source: outputPath, width: derivativeWidth, webp: convert }, produceDerivative(outputPath, derivativeWidth, convert));
  };
  // Each candidate as `srcset` lists it, and the largest as `src`.
  const candidates: string[] = [];
  let src = '';
  const widths = [...new Set(chosen.widths)].sort((a, b) => a - b);
  for (const requested of widths.filter((requested) => requested < width)) {
    const derivativePath = `${base}-${String(requested)}${extension}`;
    emitDerivative(derivativePath, requested);
    candidates.push(`/${derivativePath} ${String(requested)}w`);
    src = `/${derivativePath}`;
  }
  // The image's own width stands in for every width it cannot fill: the
  // original itself when it is public and keeps its format, and otherwise a
  // derivative at the image's width.
  if (widths.some((requested) => requested >= width)) {
    let largestPath = outputPath;
    if (isPrivate || convert) {
      largestPath = `${base}${extension}`;
      emitDerivative(largestPath, width);
    }
    candidates.push(`/${largestPath} ${String(width)}w`);
    src = `/${largestPath}`;
  }

  // Keep in sync with the escape in plugins/helpers/src/render-active-link.ts.
  const escape = (value: string): string =>
    value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const rendered: [string, string][] = [['src', src], ['srcset', candidates.join(', ')], ['sizes', chosen.sizes]];
  for (const [name, value] of given) {
    if (typeof value === 'string') {
      rendered.push([name, value]);
    }
  }
  return `<img${rendered.map(([name, value]) => ` ${name}="${escape(value)}"`).join('')}>`;
};
