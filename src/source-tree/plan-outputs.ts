// spec: docs/specs/source-tree.md

import type { SourceFiles } from './classify-source.ts';

export interface Output {
  source: string;
  output: string;
}

// Code-unit order, the same on every machine.
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// Every non-private static file written at its own path, sorted by output
// path. Two sources planning one output path fail naming both in sorted order.
export const planOutputs = ({ staticFiles }: SourceFiles): Output[] => {
  const outputs = staticFiles
    .filter((file) => !file.private)
    .map((file) => ({ source: file.path, output: file.path }))
    .sort((a, b) => compare(a.output, b.output) || compare(a.source, b.source));
  const sources = new Map<string, string>();
  for (const { source, output } of outputs) {
    const other = sources.get(output);
    if (other !== undefined) {
      throw new Error(`Both ${other} and ${source} would be written to ${output}.`);
    }
    sources.set(output, source);
  }
  return outputs;
};
