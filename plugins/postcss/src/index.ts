// spec: q-docs/specs/postcss.md

import createProcessor from 'postcss';
import type { AcceptedPlugin } from 'postcss';
import type { Plugin } from 'underdot';
import { processCss } from './process-css.ts';

export interface PostcssOptions {
  /** The PostCSS plugins every CSS file runs through, in order. */
  plugins: AcceptedPlugin[];
}

export const postcss = (options: PostcssOptions): Plugin => {
  // Checked as the values a JavaScript site can pass, not as the type narrows them.
  const given: unknown = options;
  const message = 'The plugins option must be an array of at least one PostCSS plugin.';
  if (typeof given !== 'object' || given === null) {
    throw new Error(message);
  }
  const fields: { plugins?: unknown } = given;
  if (!Array.isArray(fields.plugins) || fields.plugins.length === 0) {
    throw new Error(message);
  }
  // PostCSS rejects an entry that is not a plugin here, so the configuration
  // load fails rather than the first stylesheet.
  const processor = createProcessor(options.plugins);
  return {
    name: 'postcss',
    handlers: { '**/*.css': (file, context) => processCss(file, context, processor) },
  };
};
