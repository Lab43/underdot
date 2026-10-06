// spec: docs/specs/collections.md

import type { RenderContext } from 'underdot';

/**
 * The rendered body of the page at the URL, before its templates wrapped it.
 */
export const readPageBody = (context: RenderContext, url: unknown): string => {
  if (typeof url !== 'string') {
    throw new Error(`The URL must be a string, and ${String(url)} is not.`);
  }
  return context.readBody(url);
};
