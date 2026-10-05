import type { Plugin } from 'underdot';

const text = (contents: Buffer): string => contents.toString().trim();

// A plugin local to this site. It uppercases and renames `.txt` files, marks a
// stylesheet and gives it a map, and drops `.drop` files.
export const transform = (): Plugin => ({
  name: 'transform',
  handlers: {
    '**/*.txt': ({ outputPath, contents }) => [{ outputPath: outputPath.replace(/\.txt$/, '.text'), contents: contents.toString().toUpperCase() }],
    '**/*.css': ({ outputPath, contents }) => [
      { outputPath, contents: `${text(contents)} /* transformed */\n` },
      { outputPath: `${outputPath}.map`, contents: '{"file":"site.css"}\n' },
    ],
    '**/*.drop': () => [],
  },
});

// A plugin local to this site, marking what the handlers before it left.
export const annotate = (): Plugin => ({
  name: 'annotate',
  handlers: {
    '**/*.{text,css}': ({ outputPath, contents }) => [{ outputPath, contents: `${text(contents)} [annotated]\n` }],
  },
});
