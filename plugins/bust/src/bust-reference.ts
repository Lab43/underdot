// spec: docs/specs/bust.md

import { hash } from 'node:crypto';
import { dirname, join } from 'node:path/posix';
import type { RenderContext } from 'underdot';

/**
 * The absolute URL of a static file's output, followed by a query string that
 * changes when the output's bytes change.
 */
export const bustReference = (context: RenderContext, reference: unknown): string => {
  if (typeof reference !== 'string') {
    throw new Error(`A reference must be a string, and ${String(reference)} is not.`);
  }
  // Resolved as the context resolves a read, which also normalizes it.
  const outputPath = join(reference.startsWith('/') ? '.' : dirname(context.sourcePath), reference);
  const output = context.readOutput(reference);
  if (output === undefined) {
    throw new Error(`No static file's output is at ${reference}.`);
  }
  if (outputPath.split('/').some((segment) => segment.startsWith('_'))) {
    throw new Error(`${reference} is private, so it is never written and cannot be linked.`);
  }
  return `/${outputPath}?v=${hash('sha256', output, 'hex').slice(0, 8)}`;
};
