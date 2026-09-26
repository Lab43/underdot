// spec: docs/specs/build.md, Order of work

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describeError } from '../shared/describe-error.ts';
import type { PageFile, SourceFiles, StaticFile, TemplateFile } from '../source-tree/classify-source.ts';
import { parseFrontmatter } from '../templates/parse-frontmatter.ts';
import { runUnits } from './run-units.ts';

// What a page or template holds once read.
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
  staticFiles: StaticFile[];
}

// Parse a file's frontmatter. An error names the file.
// spec: docs/specs/templates.md
const parseContents = (sourcePath: string, text: string): FileContents => {
  try {
    const { keys, template, body } = parseFrontmatter(text);
    return { frontmatter: keys, template, body };
  } catch (error) {
    throw new Error(`${sourcePath}: ${describeError(error)}`, { cause: error });
  }
};

const readContents = async (source: string, sourcePath: string): Promise<FileContents> =>
  parseContents(sourcePath, await readFile(join(source, sourcePath), 'utf8'));

// Read every page and template. Each lands in the slot of its own index, so
// the result keeps the classification's order whichever read settles first.
export const readSite = async (source: string, sourceFiles: SourceFiles): Promise<Site> => {
  const pages = new Array<Page>(sourceFiles.pages.length);
  const templates = new Array<Template>(sourceFiles.templates.length);
  await runUnits([
    ...sourceFiles.pages.map((page, index) => async () => {
      pages[index] = { ...page, ...(await readContents(source, page.sourcePath)) };
    }),
    ...sourceFiles.templates.map((template, index) => async () => {
      templates[index] = { ...template, ...(await readContents(source, template.sourcePath)) };
    }),
  ]);
  return { pages, templates, staticFiles: sourceFiles.staticFiles };
};
