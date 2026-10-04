// spec: docs/specs/templates.md

import { mapUnits } from '../build/map-units.ts';
import type { Page, Template } from '../build/read-site.ts';
import type { MakeRenderContext } from '../plugins/bind-render-context.ts';
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

const renderBody = async (globals: Variables, makeContext: MakeRenderContext, pageChain: PageChain): Promise<RenderedBody> => {
  const { page, chain } = pageChain;
  const variables = mergeVariables(globals, pageChain);
  const body = await page.render(page.body, makeContext(page.sourcePath, { ...variables, _chain: [] }, undefined));
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
    content = await template.render(template.body, makeContext(template.sourcePath, { ...variables, _content: content, _chain: below }, bodies));
    below = [template.frontmatter, ...below];
  }
  return { sourcePath: page.sourcePath, outputPath: page.outputPath, contents: content };
};

// Every body renders before any chain, so a template can read any page's
// rendered body.
// spec: docs/specs/build.md, Order of work
export const renderPages = async (pageChains: PageChain[], globals: Variables, makeContext: MakeRenderContext): Promise<RenderedPage[]> => {
  const renderedBodies = await mapUnits(pageChains, (pageChain) => renderBody(globals, makeContext, pageChain));
  const bodies = new Map(renderedBodies.map(({ page, body }) => [page.url, body]));
  return mapUnits(renderedBodies, (renderedBody) => renderChain(makeContext, bodies, renderedBody));
};
