// spec: docs/specs/build.md

import { removeExcludedFiles } from '../configuration/remove-excluded-files.ts';
import type { ResolvedConfiguration } from '../configuration/resolve-configuration.ts';
import { registerPlugins } from '../plugins/register-plugins.ts';
import { classifySource } from '../source-tree/classify-source.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { renderPages } from '../templates/render-pages.ts';
import { resolveChains } from '../templates/resolve-chains.ts';
import { readSite } from './read-site.ts';
import { writeDestination } from './write-destination.ts';

// One build from a resolved configuration.
export const build = async ({ source, destination, exclude, plugins }: ResolvedConfiguration): Promise<void> => {
  const { renderers } = registerPlugins(plugins);
  const paths = await walkSource(source);
  const { pages, templates, staticFiles } = classifySource(removeExcludedFiles(paths, exclude), renderers);
  const site = await readSite(source, pages, templates);
  const renderedPages = await renderPages(resolveChains(site.pages, site.templates));
  await writeDestination(source, destination, staticFiles, renderedPages);
};
