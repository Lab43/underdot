// spec: docs/specs/source-tree.md

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { classifySource } from './classify-source.ts';

describe('classifySource', () => {
  test('an ordinary file and a dotfile are static and not private', () => {
    assert.deepEqual(classifySource(['index.html', '.htaccess']).staticFiles, [
      { path: 'index.html', private: false },
      { path: '.htaccess', private: false },
    ]);
  });

  test('an underscore-prefixed file is static and private, at the root or below', () => {
    assert.deepEqual(classifySource(['_private.txt', 'a/_private.txt']).staticFiles, [
      { path: '_private.txt', private: true },
      { path: 'a/_private.txt', private: true },
    ]);
  });

  test('a file inside an underscore-prefixed directory is not classified', () => {
    assert.deepEqual(classifySource(['_includes/header.html', 'a/_b/c.txt']), { staticFiles: [] });
  });

  test('the output preserves the input order', () => {
    assert.deepEqual(classifySource(['b.txt', '_includes/x.txt', 'a.txt', '_c.txt']).staticFiles, [
      { path: 'b.txt', private: false },
      { path: 'a.txt', private: false },
      { path: '_c.txt', private: true },
    ]);
  });
});
