// spec: docs/specs/templates.md

import { hash } from 'node:crypto';
import type { Versions } from '../build/bind-build.ts';
import type { Reporter } from '../build/bind-reporter.ts';
import { findVersion } from '../build/find-version.ts';
import { mapUnits } from '../build/map-units.ts';
import type { Page, Template } from '../build/read-site.ts';
import { reuseUnit } from '../build/reuse-unit.ts';
import type { InputKind, Observe, UnitRecords, Version } from '../build/reuse-unit.ts';
import { attributePluginError } from '../plugins/attribute-plugin-error.ts';
import { PluginError } from '../plugins/bind-render-context.ts';
import type { EmittedFile, MakeRenderContext, RenderContext } from '../plugins/bind-render-context.ts';
import type { PageChain } from './resolve-chains.ts';

/**
 * A page as written: its source, where it goes, its finished document, the
 * document's hash, and the files its templates' helpers emitted.
 */
export interface RenderedPage {
  sourcePath: string;
  outputPath: string;
  contents: string;
  hash: string;
  emits: EmittedFile[];
}

/**
 * A page's rendered body with its hash, before its templates wrap it, and the
 * files its helpers emitted.
 */
export interface RenderedBody {
  body: string;
  hash: string;
  emits: EmittedFile[];
}

/**
 * Every page of the build, and every file their renders emitted.
 */
export interface RenderedPages {
  pages: RenderedPage[];
  emits: EmittedFile[];
}

type Variables = Record<string, unknown>;

interface MergedPage extends PageChain {
  variables: Variables;
}

interface RenderedPageBody extends MergedPage, RenderedBody {}

const mergeVariables = (globals: Variables, { page, chain }: PageChain): Variables => {
  const variables: Variables = { ...globals };
  for (const template of chain.toReversed()) {
    Object.assign(variables, template.frontmatter);
  }
  return { ...variables, ...page.frontmatter, _url: page.url };
};

// A throw names the file that was rendering and the plugin whose function
// threw: the helper's where a helper tagged it, the renderer's otherwise.
// spec: docs/specs/plugins.md, Errors
const render = async (file: Page | Template, context: RenderContext): Promise<string> => {
  try {
    return await file.renderer.render(file.body, context);
  } catch (error) {
    const pluginName = error instanceof PluginError ? error.pluginName : file.renderer.pluginName;
    throw attributePluginError(`Rendering ${file.sourcePath}`, pluginName, error);
  }
};

// Every file of the chain is an input of the body and of the finished page,
// and so is the chain itself, which changes when a template appears.
const observeChain = (observe: Observe, { page, chain }: PageChain): void => {
  observe('file', page.sourcePath);
  for (const template of chain) {
    observe('file', template.sourcePath);
  }
  observe('chain', page.sourcePath);
};

const renderBody = async (makeContext: MakeRenderContext, merged: MergedPage, observe: Observe): Promise<RenderedBody> => {
  const { page, variables } = merged;
  observeChain(observe, merged);
  const emits: EmittedFile[] = [];
  const context = makeContext(
    page.sourcePath,
    { ...variables, _chain: [] },
    undefined,
    observe,
    emits,
    { unit: `Rendering ${page.sourcePath}`, pluginName: page.renderer.pluginName },
  );
  const body = await render(page, context);
  return { body, hash: hash('sha256', body, 'hex'), emits };
};

const renderChain = async (
  makeContext: MakeRenderContext,
  bodies: ReadonlyMap<string, string>,
  rendered: RenderedPageBody,
  observe: Observe,
): Promise<RenderedPage> => {
  // The body's emits stay out of the page's record: a body can rerun to the
  // same text, which reuses this render, with different emits.
  const { page, chain, variables, body } = rendered;
  observeChain(observe, rendered);
  observe('body', page.url);
  const emits: EmittedFile[] = [];
  let below = [page.frontmatter];
  let content = body;
  for (const template of chain) {
    const context = makeContext(
      template.sourcePath,
      { ...variables, _content: content, _chain: below },
      bodies,
      observe,
      emits,
      { unit: `Rendering ${template.sourcePath}`, pluginName: template.renderer.pluginName },
    );
    content = await render(template, context);
    below = [template.frontmatter, ...below];
  }
  return { sourcePath: page.sourcePath, outputPath: page.outputPath, contents: content, hash: hash('sha256', content, 'hex'), emits };
};

/**
 * Every body renders before any chain, so a template can read any page's
 * rendered body. A body and a finished page are each reused while every
 * input they observed stands, and a reused render contributes the emits it
 * recorded. The merge is a spread on values, so it runs for every page
 * whether or not its renders are reused.
 */
// spec: docs/specs/build.md, Order of work
// spec: docs/specs/build.md, Incremental builds
export const renderPages = async (
  pageChains: PageChain[],
  globals: Variables,
  makeContext: MakeRenderContext,
  versions: Versions,
  bodyRecords: UnitRecords<RenderedBody>,
  pageRecords: UnitRecords<RenderedPage>,
  reporter: Reporter,
): Promise<RenderedPages> => {
  for (const { page, chain } of pageChains) {
    versions.chains.set(page.sourcePath, chain.map((template) => template.sourcePath).join('\n'));
  }
  const lookup = (kind: InputKind, name: string): Version => findVersion(versions, kind, name);
  const mergedPages = pageChains.map((pageChain): MergedPage => ({
    ...pageChain,
    variables: mergeVariables(globals, pageChain),
  }));
  const renderedBodies = await mapUnits(mergedPages, async (merged): Promise<RenderedPageBody> => {
    const run = (observe: Observe): Promise<RenderedBody> => renderBody(makeContext, merged, observe);
    const rendered = await reuseUnit(bodyRecords, merged.page.sourcePath, lookup, run, reporter, `Rendered the body of ${merged.page.sourcePath}`);
    return { ...merged, ...rendered };
  });
  for (const { page, hash: bodyHash } of renderedBodies) {
    versions.bodies.set(page.url, bodyHash);
  }
  const bodies = new Map(renderedBodies.map(({ page, body }) => [page.url, body]));
  const pages = await mapUnits(renderedBodies, (rendered) => {
    const run = (observe: Observe): Promise<RenderedPage> => renderChain(makeContext, bodies, rendered, observe);
    return reuseUnit(pageRecords, rendered.page.sourcePath, lookup, run, reporter, `Rendered ${rendered.page.sourcePath}`);
  });
  // Read from this build's results and never the records, so a page removed
  // in a session stops emitting with its render.
  return { pages, emits: [...renderedBodies.flatMap(({ emits }) => emits), ...pages.flatMap(({ emits }) => emits)] };
};
