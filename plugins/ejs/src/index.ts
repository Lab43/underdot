// spec: docs/specs/ejs.md

import type { Plugin } from 'underdot';
import { renderEjs } from './render-ejs.ts';

export interface EjsOptions {
  /**
   * Directories under the source root, written without a leading slash, that
   * an include is searched in after the including file's own directory.
   */
  views?: string[];
}

export const ejs = ({ views = [] }: EjsOptions = {}): Plugin => {
  if (!Array.isArray(views)) {
    throw new Error('The views option must be an array.');
  }
  for (const entry of views) {
    if (typeof entry !== 'string' || entry === '' || entry.startsWith('/')) {
      throw new Error('Each views entry must be a directory path under the source root, written without a leading slash.');
    }
  }
  return {
    name: 'ejs',
    renderers: { ejs: (body, context) => renderEjs(body, context, views) },
  };
};
