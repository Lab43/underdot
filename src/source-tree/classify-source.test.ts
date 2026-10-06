// spec: docs/specs/source-tree.md

import { describe, expect, test } from 'vitest';
import { renderBody } from '../../test/helpers/render-body.ts';
import type { RegisteredRenderer } from '../plugins/register-plugins.ts';
import { classifySource } from './classify-source.ts';

const renderer: RegisteredRenderer = { pluginName: 'fixture', render: renderBody };
const tpl = new Map([['tpl', renderer]]);
const none = new Map<string, RegisteredRenderer>();

describe('classifySource', () => {
  describe('static files', () => {
    test('an ordinary file and a dotfile are static', () => {
      expect(classifySource(['index.html', '.htaccess'], tpl).staticFiles).toStrictEqual([{ sourcePath: 'index.html' }, { sourcePath: '.htaccess' }]);
    });

    test('an underscore-prefixed file is static, at the root or below', () => {
      expect(classifySource(['_private.txt', 'a/_private.txt'], tpl).staticFiles).toStrictEqual([{ sourcePath: '_private.txt' }, { sourcePath: 'a/_private.txt' }]);
    });

    // spec: docs/specs/source-tree.md, Underscore prefix
    test('a file inside an underscore-prefixed directory is static whatever its extension', () => {
      expect(classifySource(['_includes/header.tpl', '_includes/header.html', 'a/_b/c.txt', 'a/_b/c.tpl'], tpl)).toStrictEqual({
        pages: [],
        templates: [],
        staticFiles: [{ sourcePath: '_includes/header.tpl' }, { sourcePath: '_includes/header.html' }, { sourcePath: 'a/_b/c.txt' }, { sourcePath: 'a/_b/c.tpl' }],
      });
    });

    test('a file whose last extension has no renderer is static', () => {
      expect(classifySource(['notes.tpl.bak'], tpl)).toStrictEqual({
        pages: [],
        templates: [],
        staticFiles: [{ sourcePath: 'notes.tpl.bak' }],
      });
    });

    test('with no registered extension every file is static', () => {
      expect(classifySource(['index.tpl', '_.tpl', 'notes.txt'], none)).toStrictEqual({
        pages: [],
        templates: [],
        staticFiles: [{ sourcePath: 'index.tpl' }, { sourcePath: '_.tpl' }, { sourcePath: 'notes.txt' }],
      });
    });
  });

  describe('pages', () => {
    test.each([
      { sourcePath: 'index.tpl', directory: '', outputPath: 'index.html', url: '/' },
      { sourcePath: 'about.tpl', directory: '', outputPath: 'about/index.html', url: '/about/' },
      { sourcePath: 'about/index.tpl', directory: 'about', outputPath: 'about/index.html', url: '/about/' },
      { sourcePath: 'about/team.tpl', directory: 'about', outputPath: 'about/team/index.html', url: '/about/team/' },
      { sourcePath: '404.tpl', directory: '', outputPath: '404.html', url: '/404.html' },
      { sourcePath: 'errors/404.tpl', directory: 'errors', outputPath: 'errors/404/index.html', url: '/errors/404/' },
      { sourcePath: '.hidden.tpl', directory: '', outputPath: '.hidden/index.html', url: '/.hidden/' },
    ])('$sourcePath is written to $outputPath at $url', ({ sourcePath, directory, outputPath, url }) => {
      expect(classifySource([sourcePath], tpl).pages).toStrictEqual([
        { sourcePath, directory, extension: 'tpl', renderer, outputPath, url },
      ]);
    });
  });

  describe('templates', () => {
    test('a root template is named _ in the root directory', () => {
      expect(classifySource(['_.tpl'], tpl).templates).toStrictEqual([
        { sourcePath: '_.tpl', directory: '', extension: 'tpl', renderer, name: '_' },
      ]);
    });

    test('a named template keeps its underscore and its directory', () => {
      expect(classifySource(['blog/_post.tpl'], tpl).templates).toStrictEqual([
        { sourcePath: 'blog/_post.tpl', directory: 'blog', extension: 'tpl', renderer, name: '_post' },
      ]);
    });
  });

  test('each kind preserves the input order', () => {
    expect(classifySource(['b.txt', 'b.tpl', '_includes/x.txt', 'a.txt', 'a.tpl', '_c.txt'], tpl)).toStrictEqual({
      pages: [
        { sourcePath: 'b.tpl', directory: '', extension: 'tpl', renderer, outputPath: 'b/index.html', url: '/b/' },
        { sourcePath: 'a.tpl', directory: '', extension: 'tpl', renderer, outputPath: 'a/index.html', url: '/a/' },
      ],
      templates: [],
      staticFiles: [{ sourcePath: 'b.txt' }, { sourcePath: '_includes/x.txt' }, { sourcePath: 'a.txt' }, { sourcePath: '_c.txt' }],
    });
  });
});
