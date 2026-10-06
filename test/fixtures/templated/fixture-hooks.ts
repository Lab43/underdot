import type { Plugin } from 'underdot';

// A plugin local to this site. `pages` lists every page with the title its
// own frontmatter sets.
export const listing = (): Plugin => ({
  name: 'listing',
  pageHook: (pages) => ({
    pages: pages.map(({ sourcePath, outputPath, url, frontmatter }) => ({ sourcePath, outputPath, url, title: frontmatter.title })),
  }),
});
