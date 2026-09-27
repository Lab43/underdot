// spec: docs/specs/build.md

import { removeExcludedFiles } from '../configuration/remove-excluded-files.ts';
import type { ResolvedConfiguration } from '../configuration/resolve-configuration.ts';
import { registerPlugins } from '../plugins/register-plugins.ts';
import { classifySource } from '../source-tree/classify-source.ts';
import { planOutputs } from '../source-tree/plan-outputs.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { readSite } from './read-site.ts';
import { writeDestination } from './write-destination.ts';

// One build from a resolved configuration.
export const build = async ({ source, destination, exclude, plugins }: ResolvedConfiguration): Promise<void> => {
  const { renderers } = registerPlugins(plugins);
  const paths = await walkSource(source);
  const sourceFiles = classifySource(removeExcludedFiles(paths, exclude), new Set(renderers.keys()));
  const outputs = planOutputs(sourceFiles);
  // Nothing renders the pages yet, so the read only checks them.
  await readSite(source, sourceFiles);
  await writeDestination(source, destination, outputs);
};
