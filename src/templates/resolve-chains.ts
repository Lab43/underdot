// spec: docs/specs/templates.md, Template resolution

import { dirname, join } from 'node:path/posix';
import type { Page, Template } from '../build/read-site.ts';

// A page with its chain, nearest template first.
export interface PageChain {
  page: Page;
  chain: Template[];
}

type Index = Map<string, Template>;

const indexTemplates = (templates: Template[]): Index => {
  const index: Index = new Map();
  for (const template of templates) {
    const key = join(template.directory, template.name);
    const other = index.get(key);
    if (other !== undefined) {
      const where = template.directory === '' ? 'the source root' : template.directory;
      throw new Error(`Both ${other.sourcePath} and ${template.sourcePath} are the template ${template.name} in ${where}.`);
    }
    index.set(key, template);
  }
  return index;
};

const findParent = (directory: string): string | undefined => {
  if (directory === '') {
    return undefined;
  }
  const parent = dirname(directory);
  return parent === '.' ? '' : parent;
};

const deriveAskedName = ({ template }: Page | Template): string => (template === undefined ? '_' : `_${template}`);

const findSearchStart = (template: Template): string | undefined =>
  template.template === undefined && template.name === '_' ? findParent(template.directory) : template.directory;

const findTemplate = (index: Index, name: string, directory: string | undefined): Template | undefined => {
  for (let current = directory; current !== undefined; current = findParent(current)) {
    const found = index.get(join(current, name));
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
};

// Typed on the binding so the checker knows a call never returns.
const failMissing: (name: string, sourcePath: string) => never = (name, sourcePath) => {
  throw new Error(`No template ${name} is in the directory of ${sourcePath} or above it.`);
};

const findNext = (index: Index, template: Template): Template | undefined =>
  findTemplate(index, deriveAskedName(template), findSearchStart(template));

const resolveChain = (index: Index, page: Page): Template[] => {
  const chain = new Set<Template>();
  let template = findTemplate(index, deriveAskedName(page), page.directory);
  if (template === undefined) {
    failMissing(deriveAskedName(page), page.sourcePath);
  }
  chain.add(template);
  for (let next = findNext(index, template); next !== undefined; next = findNext(index, template)) {
    if (chain.has(next)) {
      throw new Error(`${template.sourcePath} asks for ${next.sourcePath}, which is already in its chain.`);
    }
    chain.add(next);
    template = next;
  }
  if (template.template !== undefined) {
    failMissing(deriveAskedName(template), template.sourcePath);
  }
  return [...chain];
};

export const resolveChains = (pages: Page[], templates: Template[]): PageChain[] => {
  const index = indexTemplates(templates);
  return pages.map((page) => ({ page, chain: resolveChain(index, page) }));
};
