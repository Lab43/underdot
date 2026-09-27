// spec: docs/specs/source-tree.md

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { classifySource } from './classify-source.ts';

const tpl = new Set(['tpl']);
const none = new Set<string>();

describe('classifySource', () => {
  describe('static files', () => {
    test('an ordinary file and a dotfile are static and not private', () => {
      assert.deepEqual(classifySource(['index.html', '.htaccess'], tpl).staticFiles, [
        { sourcePath: 'index.html', private: false },
        { sourcePath: '.htaccess', private: false },
      ]);
    });

    test('an underscore-prefixed file is static and private, at the root or below', () => {
      assert.deepEqual(classifySource(['_private.txt', 'a/_private.txt'], tpl).staticFiles, [
        { sourcePath: '_private.txt', private: true },
        { sourcePath: 'a/_private.txt', private: true },
      ]);
    });

    test('a file whose last extension has no renderer is static', () => {
      assert.deepEqual(classifySource(['notes.tpl.bak'], tpl), {
        pages: [],
        templates: [],
        staticFiles: [{ sourcePath: 'notes.tpl.bak', private: false }],
      });
    });

    test('with no registered extension every file is static', () => {
      assert.deepEqual(classifySource(['index.tpl', '_.tpl', 'notes.txt'], none), {
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
    for (const [sourcePath, directory, outputPath, url] of [
      ['index.tpl', '', 'index.html', '/'],
      ['about.tpl', '', 'about/index.html', '/about/'],
      ['about/index.tpl', 'about', 'about/index.html', '/about/'],
      ['about/team.tpl', 'about', 'about/team/index.html', '/about/team/'],
      ['404.tpl', '', '404.html', '/404.html'],
      ['errors/404.tpl', 'errors', 'errors/404/index.html', '/errors/404/'],
      ['.hidden.tpl', '', '.hidden/index.html', '/.hidden/'],
    ] as const) {
      test(`${sourcePath} is written to ${outputPath} at ${url}`, () => {
        assert.deepEqual(classifySource([sourcePath], tpl).pages, [
          { sourcePath, directory, extension: 'tpl', outputPath, url },
        ]);
      });
    }
  });

  describe('templates', () => {
    test('a root template is named _ in the root directory', () => {
      assert.deepEqual(classifySource(['_.tpl'], tpl).templates, [
        { sourcePath: '_.tpl', directory: '', extension: 'tpl', name: '_' },
      ]);
    });

    test('a named template keeps its underscore and its directory', () => {
      assert.deepEqual(classifySource(['blog/_post.tpl'], tpl).templates, [
        { sourcePath: 'blog/_post.tpl', directory: 'blog', extension: 'tpl', name: '_post' },
      ]);
    });
  });

  test('a file inside an underscore-prefixed directory is not classified', () => {
    assert.deepEqual(classifySource(['_includes/header.tpl', '_includes/header.html', 'a/_b/c.txt'], tpl), {
      pages: [],
      templates: [],
      staticFiles: [],
    });
  });

  test('each kind preserves the input order', () => {
    assert.deepEqual(classifySource(['b.txt', 'b.tpl', '_includes/x.txt', 'a.txt', 'a.tpl', '_c.txt'], tpl), {
      pages: [
        { sourcePath: 'b.tpl', directory: '', extension: 'tpl', outputPath: 'b/index.html', url: '/b/' },
        { sourcePath: 'a.tpl', directory: '', extension: 'tpl', outputPath: 'a/index.html', url: '/a/' },
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
