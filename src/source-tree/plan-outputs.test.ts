// spec: docs/specs/source-tree.md

import { describe, expect, test } from 'vitest';
import type { PageFile, SourceFiles, StaticFile, TemplateFile } from './classify-source.ts';
import { planOutputs } from './plan-outputs.ts';

const page = (sourcePath: string, outputPath: string): PageFile => ({ sourcePath, directory: '', extension: 'tpl', outputPath, url: '/' });
const template = (sourcePath: string, name: string): TemplateFile => ({ sourcePath, directory: '', extension: 'tpl', name });
const staticFile = (sourcePath: string, isPrivate = false): StaticFile => ({ sourcePath, private: isPrivate });

const sourceFiles = (files: Partial<SourceFiles>): SourceFiles => ({ pages: [], templates: [], staticFiles: [], ...files });

describe('planOutputs', () => {
  test('a non-private file plans its own path', () => {
    expect(planOutputs(sourceFiles({ staticFiles: [staticFile('about/index.html')] }))).toStrictEqual([
      { sourcePath: 'about/index.html', outputPath: 'about/index.html' },
    ]);
  });

  test('a private file plans nothing', () => {
    expect(planOutputs(sourceFiles({ staticFiles: [staticFile('_private.txt', true)] }))).toStrictEqual([]);
  });

  test('outputs come back sorted by output path whatever the input order', () => {
    const staticFiles = [
      staticFile('styles/site.css'),
      staticFile('index.html'),
      staticFile('.htaccess'),
      staticFile('about/index.html'),
    ];
    expect(planOutputs(sourceFiles({ staticFiles })).map((output) => output.outputPath)).toStrictEqual([
      '.htaccess',
      'about/index.html',
      'index.html',
      'styles/site.css',
    ]);
  });

  test('two files planning one output path fail naming both', () => {
    const staticFiles = [staticFile('index.html'), staticFile('about/index.html'), staticFile('index.html')];
    expect(() => planOutputs(sourceFiles({ staticFiles }))).toThrow(
      new Error('Both index.html and index.html would be written to index.html.'),
    );
  });

  test('a page is checked and not copied', () => {
    const files = sourceFiles({ pages: [page('about.tpl', 'about/index.html')], staticFiles: [staticFile('notes.txt')] });
    expect(planOutputs(files)).toStrictEqual([{ sourcePath: 'notes.txt', outputPath: 'notes.txt' }]);
  });

  test('a template plans nothing', () => {
    expect(planOutputs(sourceFiles({ templates: [template('_.tpl', '_')] }))).toStrictEqual([]);
  });

  test('a page and a static file planning one output path fail naming both', () => {
    const files = sourceFiles({ pages: [page('about.tpl', 'about/index.html')], staticFiles: [staticFile('about/index.html')] });
    expect(() => planOutputs(files)).toThrow(
      new Error('Both about.tpl and about/index.html would be written to about/index.html.'),
    );
  });

  test('a page beside a directory index with the same URL fails naming both', () => {
    const files = sourceFiles({ pages: [page('about.tpl', 'about/index.html'), page('about/index.tpl', 'about/index.html')] });
    expect(() => planOutputs(files)).toThrow(
      new Error('Both about.tpl and about/index.tpl would be written to about/index.html.'),
    );
  });

  test('two pages with one name and different extensions fail naming both', () => {
    const files = sourceFiles({ pages: [page('about.tpl', 'about/index.html'), page('about.md', 'about/index.html')] });
    expect(() => planOutputs(files)).toThrow(
      new Error('Both about.md and about.tpl would be written to about/index.html.'),
    );
  });
});
