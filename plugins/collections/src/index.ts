// spec: q-docs/specs/collections.md

import type { Plugin } from 'underdot';
import { collectPages } from './collect-pages.ts';
import { readPageBody } from './read-page-body.ts';

/**
 * Each key names a collection, the global it defines, and its value is the
 * directory under the source root whose pages the collection holds, written
 * without a leading or trailing slash: `{ posts: 'posts' }`.
 */
export type CollectionsOptions = Record<string, string>;

export const collections = (directories: CollectionsOptions = {}): Plugin => {
  // Checked as the values a JavaScript site can pass, not as the type narrows them.
  const given: unknown = directories;
  if (typeof given !== 'object' || given === null || Array.isArray(given)) {
    throw new Error('The collections must be an object of names to directories.');
  }
  for (const [name, directory] of Object.entries<unknown>(directories)) {
    if (typeof directory !== 'string' || directory === '' || directory.startsWith('/') || directory.endsWith('/')) {
      throw new Error(`The directory of ${name} must be a path under the source root, written without a leading or trailing slash.`);
    }
  }
  return {
    name: 'collections',
    pageHook: (pages) => collectPages(pages, directories),
    helpers: { pageBody: readPageBody },
  };
};
