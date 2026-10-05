import type { Plugin } from 'underdot';

// A plugin local to this site. It collapses every run of whitespace in a
// stylesheet to one space.
export const collapse = (): Plugin => ({
  name: 'collapse',
  handlers: {
    '**/*.css': ({ outputPath, contents }) => [{ outputPath, contents: `${contents.toString().replace(/\s+/g, ' ').trim()}\n` }],
  },
});
