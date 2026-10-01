// spec: docs/specs/source-tree.md

import { describe, expect, test } from 'vitest';
import { renderBody } from '../../test/helpers/render-body.ts';
import { classifySource } from './classify-source.ts';

const tpl = new Map([['tpl', { render: renderBody }]]);
const none = new Map<string, { render: typeof renderBody }>();

describe('classifySource', () => {
  describe('static files', () => {
    test('an ordinary file and a dotfile are static and not private', () => {
      expect(classifySource(['index.html', '.htaccess'], tpl).staticFiles).toStrictEqual([
        { sourcePath: 'index.html', private: false },
        { sourcePath: '.htaccess', private: false },
      ]);
    });

    test('an underscore-prefixed file is static and private, at the root or below', () => {
      expect(classifySource(['_private.txt', 'a/_private.txt'], tpl).staticFiles).toStrictEqual([
        { sourcePath: '_private.txt', private: true },
        { sourcePath: 'a/_private.txt', private: true },
      ]);
    });

    test('a file whose last extension has no renderer is static', () => {
      expect(classifySource(['notes.tpl.bak'], tpl)).toStrictEqual({
        pages: [],
        templates: [],
        staticFiles: [{ sourcePath: 'notes.tpl.bak', private: false }],
      });
    });

    test('with no registered extension every file is static', () => {
      expect(classifySource(['index.tpl', '_.tpl', 'notes.txt'], none)).toStrictEqual({
        pages: [],
        templates: [],
        staticFiles: [
          { sourcePath: 'index.tpl', private: false },
          { sourcePath: '_.tpl', private: true },
          { sourcePath: 'notes.txt', private: false },
        ],
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
        { sourcePath, directory, extension: 'tpl', render: renderBody, outputPath, url },
      ]);
    });
  });

  describe('templates', () => {
    test('a root template is named _ in the root directory', () => {
      expect(classifySource(['_.tpl'], tpl).templates).toStrictEqual([
        { sourcePath: '_.tpl', directory: '', extension: 'tpl', render: renderBody, name: '_' },
      ]);
    });

    test('a named template keeps its underscore and its directory', () => {
      expect(classifySource(['blog/_post.tpl'], tpl).templates).toStrictEqual([
        { sourcePath: 'blog/_post.tpl', directory: 'blog', extension: 'tpl', render: renderBody, name: '_post' },
      ]);
    });
  });

  test('a file inside an underscore-prefixed directory is not classified', () => {
    expect(classifySource(['_includes/header.tpl', '_includes/header.html', 'a/_b/c.txt'], tpl)).toStrictEqual({
      pages: [],
      templates: [],
      staticFiles: [],
    });
  });

  test('each kind preserves the input order', () => {
    expect(classifySource(['b.txt', 'b.tpl', '_includes/x.txt', 'a.txt', 'a.tpl', '_c.txt'], tpl)).toStrictEqual({
      pages: [
        { sourcePath: 'b.tpl', directory: '', extension: 'tpl', render: renderBody, outputPath: 'b/index.html', url: '/b/' },
        { sourcePath: 'a.tpl', directory: '', extension: 'tpl', render: renderBody, outputPath: 'a/index.html', url: '/a/' },
      ],
      templates: [],
      staticFiles: [
        { sourcePath: 'b.txt', private: false },
        { sourcePath: 'a.txt', private: false },
        { sourcePath: '_c.txt', private: true },
      ],
    });
  });
});
