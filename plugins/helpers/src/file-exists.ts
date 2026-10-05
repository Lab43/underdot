// spec: docs/specs/helpers.md

import type { RenderContext } from 'underdot';

/**
 * Whether the build will serve a static file's output at the reference.
 */
export const fileExists = (context: RenderContext, reference: unknown): boolean => {
  if (typeof reference !== 'string') {
    throw new Error(`The reference must be a string, and ${String(reference)} is not.`);
  }
  return context.readOutput(reference) !== undefined;
};
