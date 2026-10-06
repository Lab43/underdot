// spec: docs/specs/build.md

import { removeExcludedFiles } from '../configuration/remove-excluded-files.ts';
import type { ResolvedConfiguration } from '../configuration/resolve-configuration.ts';
import { bindRenderContext } from '../plugins/bind-render-context.ts';
import { handleFiles } from '../plugins/handle-files.ts';
import { registerPlugins } from '../plugins/register-plugins.ts';
import { runPageHooks } from '../plugins/run-page-hooks.ts';
import { classifySource } from '../source-tree/classify-source.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { defineGlobals } from '../templates/define-globals.ts';
import { readData } from '../templates/read-data.ts';
import { renderPages } from '../templates/render-pages.ts';
import { resolveChains } from '../templates/resolve-chains.ts';
import { readSite } from './read-site.ts';
import { writeDestination } from './write-destination.ts';

/**
 * One build from a resolved configuration.
 */
export const build = async ({ source, destination, exclude, plugins, globals }: ResolvedConfiguration): Promise<void> => {
  const { renderers, helpers, handlers, hooks } = registerPlugins(plugins);
  const paths = removeExcludedFiles(await walkSource(source), exclude);
  const { pages, templates, staticFiles } = classifySource(paths, renderers);
  const dataVariables = await readData(source, paths);
  const site = await readSite(source, pages, templates, helpers);
  const outputs = await handleFiles(source, staticFiles, handlers);
  const hookGlobals = await runPageHooks(site.pages, hooks);
  // Every walked file is readable, those inside private directories included.
  // spec: docs/specs/source-tree.md, Underscore prefix
  const makeContext = bindRenderContext(source, new Set(paths), helpers, outputs);
  const renderedPages = await renderPages(resolveChains(site.pages, site.templates), defineGlobals(globals, dataVariables, hookGlobals, helpers), makeContext);
  await writeDestination(source, destination, outputs, renderedPages);
};
