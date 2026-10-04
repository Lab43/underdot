// spec: docs/specs/source-tree.md

import { basename, dirname, extname } from 'node:path/posix';
import type { Renderer } from '../plugins/register-plugins.ts';

export interface PageFile {
  sourcePath: string;
  directory: string;
  extension: string;
  render: Renderer;
  outputPath: string;
  url: string;
}

export interface TemplateFile {
  sourcePath: string;
  directory: string;
  extension: string;
  render: Renderer;
  /**
   * The file name without its extension, `_` or `_post`, which a page's
   * `template: post` directive selects.
   */
  name: string;
}

export interface StaticFile {
  sourcePath: string;
  private: boolean;
}

/**
 * The files the source holds, by kind.
 */
export interface SourceFiles {
  pages: PageFile[];
  templates: TemplateFile[];
  staticFiles: StaticFile[];
}

const isPrivate = (name: string): boolean => name.startsWith('_');

// The file's directory under the source root, the empty string at the root.
const findDirectory = (sourcePath: string): string => {
  const directory = dirname(sourcePath);
  return directory === '.' ? '' : directory;
};

// Where a page is written.
const planOutput = (directory: string, name: string): string => {
  if (name === '404' && directory === '') {
    return '404.html';
  }
  const segments = directory === '' ? [] : [directory];
  if (name !== 'index') {
    segments.push(name);
  }
  return [...segments, 'index.html'].join('/');
};

// The output path with a leading slash and a trailing `index.html` removed.
const deriveUrl = (outputPath: string): string => `/${outputPath.replace(/index\.html$/, '')}`;

/**
 * Classify every path by the extensions that have a renderer.
 */
export const classifySource = (sourcePaths: string[], renderers: ReadonlyMap<string, { render: Renderer }>): SourceFiles => {
  const sourceFiles: SourceFiles = { pages: [], templates: [], staticFiles: [] };
  for (const sourcePath of sourcePaths) {
    const directory = findDirectory(sourcePath);
    if (directory.split('/').some(isPrivate)) {
      continue;
    }
    const fileName = basename(sourcePath);
    const extension = extname(sourcePath).slice(1);
    const renderer = renderers.get(extension);
    if (renderer === undefined) {
      sourceFiles.staticFiles.push({ sourcePath, private: isPrivate(fileName) });
      continue;
    }
    const { render } = renderer;
    const name = basename(sourcePath, `.${extension}`);
    if (isPrivate(name)) {
      sourceFiles.templates.push({ sourcePath, directory, extension, render, name });
    } else {
      const outputPath = planOutput(directory, name);
      sourceFiles.pages.push({ sourcePath, directory, extension, render, outputPath, url: deriveUrl(outputPath) });
    }
  }
  return sourceFiles;
};
