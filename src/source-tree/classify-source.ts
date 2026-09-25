// spec: docs/specs/source-tree.md

import { basename, dirname } from 'node:path/posix';

export interface StaticFile {
  path: string;
  private: boolean;
}

// The files the source holds, by kind. Pages and templates arrive with the
// first renderer.
export interface SourceFiles {
  staticFiles: StaticFile[];
}

const isPrivate = (name: string): boolean => name.startsWith('_');

// No renderer is registered yet, so every classified file is static. A file
// inside a private directory is not classified at all.
export const classifySource = (paths: string[]): SourceFiles => ({
  staticFiles: paths
    .filter((path) => !dirname(path).split('/').some(isPrivate))
    .map((path) => ({ path, private: isPrivate(basename(path)) })),
});
