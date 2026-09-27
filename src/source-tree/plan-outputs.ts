// spec: docs/specs/source-tree.md

import type { SourceFiles } from './classify-source.ts';

export interface Output {
  sourcePath: string;
  outputPath: string;
}

// Compare by character code rather than by locale, so every machine sorts alike.
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// Sorting fixes the order the writer works in and the order a collision names
// its two files in, whichever order the entries were assembled in.
const compareOutputs = (a: Output, b: Output): number =>
  compare(a.outputPath, b.outputPath) || compare(a.sourcePath, b.sourcePath);

// Two sources planning one output path fail naming both in sorted order.
const checkUniqueness = (outputs: Output[]): void => {
  const sourcePaths = new Map<string, string>();
  for (const { sourcePath, outputPath } of outputs) {
    const other = sourcePaths.get(outputPath);
    if (other !== undefined) {
      throw new Error(`Both ${other} and ${sourcePath} would be written to ${outputPath}.`);
    }
    sourcePaths.set(outputPath, sourcePath);
  }
};

// Check every planned output together, and return only the static copies: a
// page has no file to copy until it is rendered.
export const planOutputs = ({ pages, staticFiles }: SourceFiles): Output[] => {
  const copies = staticFiles
    .filter((file) => !file.private)
    .map((file) => ({ sourcePath: file.sourcePath, outputPath: file.sourcePath }))
    .sort(compareOutputs);
  const outputs = [...pages.map((page) => ({ sourcePath: page.sourcePath, outputPath: page.outputPath })), ...copies].sort(compareOutputs);
  checkUniqueness(outputs);
  return copies;
};
