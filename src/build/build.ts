// spec: docs/specs/build.md

import { removeExcludedFiles } from '../configuration/remove-excluded-files.ts';
import type { ResolvedConfiguration } from '../configuration/resolve-configuration.ts';
import { classifySource } from '../source-tree/classify-source.ts';
import { planOutputs } from '../source-tree/plan-outputs.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { writeDestination } from './write-destination.ts';

// One build from a resolved configuration: walk, exclude, classify, plan, write.
export const build = async ({ source, destination, exclude }: ResolvedConfiguration): Promise<void> => {
  const paths = await walkSource(source);
  const sourceFiles = classifySource(removeExcludedFiles(paths, exclude));
  const outputs = planOutputs(sourceFiles);
  await writeDestination(source, destination, outputs);
};
