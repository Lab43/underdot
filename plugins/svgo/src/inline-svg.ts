// spec: q-docs/specs/svgo.md

import type { RenderContext } from 'underdot';

/**
 * The optimized SVG at the reference, as text, read from the handled output.
 */
export const inlineSvg = (context: RenderContext, reference: unknown): string => {
  if (typeof reference !== 'string') {
    throw new Error(`The reference must be a string, and ${String(reference)} is not.`);
  }
  const output = context.readOutput(reference);
  if (output === undefined) {
    throw new Error(`No static file's output is at ${reference}.`);
  }
  return output.toString('utf8');
};
