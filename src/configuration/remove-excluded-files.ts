// spec: docs/specs/configuration.md, Excluded files

import { minimatch } from 'minimatch';

// Dot mode: a dotfile is an ordinary file to the source tree, so a pattern
// matches it like any other name.
const options = { dot: true };

export const removeExcludedFiles = (paths: string[], patterns: string[]): string[] =>
  paths.filter((path) => !patterns.some((pattern) => minimatch(path, pattern, options)));
