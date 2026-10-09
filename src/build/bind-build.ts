// spec: docs/specs/build.md

import { removeExcludedFiles } from '../configuration/remove-excluded-files.ts';
import type { ResolvedConfiguration } from '../configuration/resolve-configuration.ts';
import { bindRenderContext } from '../plugins/bind-render-context.ts';
import { handleFiles } from '../plugins/handle-files.ts';
import type { Output } from '../plugins/handle-files.ts';
import { produceFiles } from '../plugins/produce-files.ts';
import type { EmittedOutput } from '../plugins/produce-files.ts';
import { registerPlugins } from '../plugins/register-plugins.ts';
import { runPageHooks } from '../plugins/run-page-hooks.ts';
import type { HookGlobal } from '../plugins/run-page-hooks.ts';
import { classifySource } from '../source-tree/classify-source.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { defineGlobals } from '../templates/define-globals.ts';
import { readData } from '../templates/read-data.ts';
import { renderPages } from '../templates/render-pages.ts';
import type { RenderedBody, RenderedPage } from '../templates/render-pages.ts';
import { resolveChains } from '../templates/resolve-chains.ts';
import type { Reporter } from './bind-reporter.ts';
import { hashFiles } from './hash-files.ts';
import type { FileTable } from './hash-files.ts';
import { readSite } from './read-site.ts';
import type { FileContents } from './read-site.ts';
import type { UnitRecords } from './reuse-unit.ts';
import { versionGlobals } from './version-globals.ts';
import { writeDestination } from './write-destination.ts';

/**
 * The version of every input a render can observe in one build: the file
 * table, each handled output by its output path, each global by name, every
 * global at once, each page's chain by the page's source path, and each
 * page's body by its URL.
 */
export interface Versions {
  files: FileTable;
  outputs: Map<string, string>;
  globals: Map<string, string>;
  allGlobals: string;
  chains: Map<string, string>;
  bodies: Map<string, string>;
}

/**
 * How many units one build ran and how many it reused.
 */
export interface BuildCounts {
  ran: number;
  reused: number;
}

/**
 * Bind a resolved configuration. The function returned runs one build and
 * resolves to its counts, and every build it runs shares the memory of the
 * ones before, so a unit whose inputs are unchanged is reused. A function
 * called once reuses nothing.
 */
export const bindBuild = (
  { source, destination, exclude, plugins, globals }: ResolvedConfiguration,
  reporter: Reporter,
): (() => Promise<BuildCounts>) => {
  let files: FileTable = new Map();
  const dataRecords: UnitRecords<unknown> = new Map();
  const contentsRecords: UnitRecords<FileContents> = new Map();
  const outputRecords: UnitRecords<Output[]> = new Map();
  const hookRecords: UnitRecords<HookGlobal[]> = new Map();
  const bodyRecords: UnitRecords<RenderedBody> = new Map();
  const pageRecords: UnitRecords<RenderedPage> = new Map();
  const producedRecords: UnitRecords<EmittedOutput[]> = new Map();
  const written = new Map<string, string>();
  return async () => {
    // Counted by this run, so a failed build before it or a report between
    // builds cannot skew the counts.
    const counts: BuildCounts = { ran: 0, reused: 0 };
    const countingReporter: Reporter = {
      ...reporter,
      ran: (unit, changes) => {
        counts.ran += 1;
        reporter.ran(unit, changes);
      },
      reused: (unit) => {
        counts.reused += 1;
        reporter.reused(unit);
      },
    };
    const { pluginNames, renderers, helpers, handlers, hooks } = registerPlugins(plugins);
    const paths = removeExcludedFiles(await walkSource(source), exclude);
    files = await hashFiles(source, paths, files);
    const { pages, templates, staticFiles } = classifySource(paths, renderers);
    const dataVariables = await readData(source, paths, files, dataRecords, countingReporter);
    const site = await readSite(source, pages, templates, helpers, files, contentsRecords, countingReporter);
    const outputs = await handleFiles(source, staticFiles, handlers, files, outputRecords, countingReporter);
    const hookGlobals = await runPageHooks(site.pages, hooks, hookRecords, countingReporter);
    const definedGlobals = defineGlobals(globals, dataVariables, hookGlobals, helpers);
    const globalVersions = versionGlobals(globals, dataVariables, hookGlobals, files);
    const versions: Versions = {
      files,
      outputs: new Map(outputs.map(({ outputPath, hash }) => [outputPath, hash])),
      globals: globalVersions,
      allGlobals: globalVersions.entries().map(([name, version]) => `${name}:${version}`).toArray().sort().join('\n'),
      chains: new Map(),
      bodies: new Map(),
    };
    // Every walked file is readable, those inside private directories included.
    // spec: docs/specs/source-tree.md, Underscore prefix
    const makeContext = bindRenderContext(source, files, helpers, outputs, countingReporter);
    const { pages: renderedPages, emits } = await renderPages(
      resolveChains(site.pages, site.templates),
      definedGlobals,
      makeContext,
      versions,
      bodyRecords,
      pageRecords,
      countingReporter,
    );
    const emitted = await produceFiles(
      source,
      destination,
      emits,
      handlers,
      pluginNames,
      outputs,
      files,
      written,
      producedRecords,
      countingReporter,
    );
    await writeDestination(source, destination, outputs, emitted, renderedPages, written, countingReporter);
    return counts;
  };
};
