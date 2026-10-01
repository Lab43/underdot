// spec: docs/specs/templates.md

import { mapUnits } from '../build/map-units.ts';
import type { Page, Template } from '../build/read-site.ts';
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

const mergeVariables = ({ page, chain }: PageChain): Variables => {
  const variables: Variables = {};
  for (const template of chain.toReversed()) {
    Object.assign(variables, template.frontmatter);
  }
  return { ...variables, ...page.frontmatter, _url: page.url };
};

const renderBody = async (pageChain: PageChain): Promise<RenderedBody> => {
  const { page, chain } = pageChain;
  const variables = mergeVariables(pageChain);
  const body = await page.render(page.body, { sourcePath: page.sourcePath, variables: { ...variables, _chain: [] } });
  return { page, chain, variables, body };
};

const renderChain = async ({ page, chain, variables, body }: RenderedBody): Promise<RenderedPage> => {
  let below = [page.frontmatter];
  let content = body;
  for (const template of chain) {
    content = await template.render(template.body, {
      sourcePath: template.sourcePath,
      variables: { ...variables, _content: content, _chain: below },
    });
    below = [template.frontmatter, ...below];
  }
  return { sourcePath: page.sourcePath, outputPath: page.outputPath, contents: content };
};

// Every body renders before any chain, so a template can read any page's
// rendered body.
// spec: docs/specs/build.md, Order of work
export const renderPages = async (pageChains: PageChain[]): Promise<RenderedPage[]> => {
  const renderedBodies = await mapUnits(pageChains, renderBody);
  return mapUnits(renderedBodies, renderChain);
};
