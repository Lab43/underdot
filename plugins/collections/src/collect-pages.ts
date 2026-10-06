// spec: docs/specs/collections.md

import type { HookPage } from 'underdot';

/**
 * One page of a collection: its frontmatter as written, with its URL under
 * `_url`. The item and the list holding it are frozen.
 */
export interface CollectionItem {
  readonly _url: string;
  readonly [key: string]: unknown;
}

/**
 * The collection each directory defines: the pages below the directory's URL,
 * in the order given, as a frozen list of frozen items.
 */
export const collectPages = (
  pages: readonly HookPage[],
  directories: Readonly<Record<string, string>>,
): Record<string, readonly CollectionItem[]> => {
  const collections: Record<string, readonly CollectionItem[]> = {};
  for (const [name, directory] of Object.entries(directories)) {
    // The directory's own page has the prefix as its URL and is the index of
    // the space, not a member.
    const prefix = `/${directory}/`;
    const items = pages
      .filter(({ url }) => url.startsWith(prefix) && url !== prefix)
      .map(({ url, frontmatter }) => Object.freeze({ ...frontmatter, _url: url }));
    collections[name] = Object.freeze(items);
  }
  return collections;
};
