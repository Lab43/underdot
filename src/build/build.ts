// spec: docs/specs/build.md

import { removeExcludedFiles } from '../configuration/remove-excluded-files.ts';
import { resolveConfiguration } from '../configuration/resolve-configuration.ts';
import type { Configuration } from '../configuration/resolve-configuration.ts';
import { classifySource } from '../source-tree/classify-source.ts';
import { planOutputs } from '../source-tree/plan-outputs.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { writeDestination } from './write-destination.ts';

// What `underdot build` does: resolve, walk, exclude, classify, plan, write.
// Resolving here fails a bad configuration before any work starts, for every caller.
export const build = async (configuration: Configuration, projectDirectory = process.cwd()): Promise<void> => {
  const { source, destination, exclude } = resolveConfiguration(configuration, projectDirectory);
  const paths = await walkSource(source);
  const sourceFiles = classifySource(removeExcludedFiles(paths, exclude));
  const outputs = planOutputs(sourceFiles);
  await writeDestination(source, destination, outputs);
};
