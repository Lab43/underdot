// spec: docs/specs/templates.md

import { mapUnits } from '../build/map-units.ts';
import type { Page, Template } from '../build/read-site.ts';
import { attributePluginError } from '../plugins/attribute-plugin-error.ts';
import { PluginError } from '../plugins/bind-render-context.ts';
import type { MakeRenderContext, RenderContext } from '../plugins/bind-render-context.ts';
import type { PageChain } from './resolve-chains.ts';

export interface RenderedPage {
  sourcePath: string;
  outputPath: string;
  contents: string;
}

type Variables = Record<string, unknown>;

interface RenderedBody {
  page: Page;
  chain: Template[];
  variables: Variables;
  body: string;
}

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

const renderBody = async (globals: Variables, makeContext: MakeRenderContext, pageChain: PageChain): Promise<RenderedBody> => {
  const { page, chain } = pageChain;
  const variables = mergeVariables(globals, pageChain);
  const body = await render(page, makeContext(page.sourcePath, { ...variables, _chain: [] }, undefined));
  return { page, chain, variables, body };
};

const renderChain = async (
  makeContext: MakeRenderContext,
  bodies: ReadonlyMap<string, string>,
  { page, chain, variables, body }: RenderedBody,
): Promise<RenderedPage> => {
  let below = [page.frontmatter];
  let content = body;
  for (const template of chain) {
    content = await render(template, makeContext(template.sourcePath, { ...variables, _content: content, _chain: below }, bodies));
    below = [template.frontmatter, ...below];
  }
  return { sourcePath: page.sourcePath, outputPath: page.outputPath, contents: content };
};

/**
 * Every body renders before any chain, so a template can read any page's
 * rendered body.
 */
// spec: docs/specs/build.md, Order of work
export const renderPages = async (pageChains: PageChain[], globals: Variables, makeContext: MakeRenderContext): Promise<RenderedPage[]> => {
  const renderedBodies = await mapUnits(pageChains, (pageChain) => renderBody(globals, makeContext, pageChain));
  const bodies = new Map(renderedBodies.map(({ page, body }) => [page.url, body]));
  return mapUnits(renderedBodies, (renderedBody) => renderChain(makeContext, bodies, renderedBody));
};
