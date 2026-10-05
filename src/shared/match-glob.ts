import { minimatch } from 'minimatch';

// Dot mode: a dotfile is an ordinary file to the source tree, so a pattern
// matches it like any other name.
const options = { dot: true };

/**
 * Whether a path with forward slashes matches a glob in minimatch's dialect.
 */
export const matchGlob = (path: string, glob: string): boolean => minimatch(path, glob, options);
