// spec: docs/specs/build.md, Order of work

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { attributeError } from '../shared/attribute-error.ts';
import type { PageFile, TemplateFile } from '../source-tree/classify-source.ts';
import { parseFrontmatter } from '../templates/parse-frontmatter.ts';
import { runUnits } from './run-units.ts';

/**
 * What a page or template holds once read.
 */
export interface FileContents {
  frontmatter: Record<string, unknown>;
  template: string | undefined;
  body: string;
}

export interface Page extends PageFile, FileContents {}

export interface Template extends TemplateFile, FileContents {}

export interface Site {
  pages: Page[];
  templates: Template[];
}

// Parse a file's frontmatter. An error names the file.
// spec: docs/specs/templates.md
const parseContents = (sourcePath: string, text: string): FileContents => {
  try {
    const { keys, template, body } = parseFrontmatter(text);
    return { frontmatter: keys, template, body };
  } catch (error) {
    throw attributeError(sourcePath, error);
  }
};

const readContents = async (source: string, sourcePath: string): Promise<FileContents> =>
  parseContents(sourcePath, await readFile(join(source, sourcePath), 'utf8'));

/**
 * Read every page and template. Each lands in the slot of its own index, so
 * the result keeps the classification's order whichever read settles first.
 */
export const readSite = async (source: string, pageFiles: PageFile[], templateFiles: TemplateFile[]): Promise<Site> => {
  const pages = new Array<Page>(pageFiles.length);
  const templates = new Array<Template>(templateFiles.length);
  await runUnits([
    ...pageFiles.map((page, index) => async () => {
      pages[index] = { ...page, ...(await readContents(source, page.sourcePath)) };
    }),
    ...templateFiles.map((template, index) => async () => {
      templates[index] = { ...template, ...(await readContents(source, template.sourcePath)) };
    }),
  ]);
  return { pages, templates };
};
