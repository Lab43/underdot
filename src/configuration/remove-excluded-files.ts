// spec: docs/specs/configuration.md, Excluded files

import { matchGlob } from '../shared/match-glob.ts';

export const removeExcludedFiles = (paths: string[], patterns: string[]): string[] =>
  paths.filter((path) => !patterns.some((pattern) => matchGlob(path, pattern)));
