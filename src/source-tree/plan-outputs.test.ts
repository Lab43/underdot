// spec: docs/specs/source-tree.md

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { planOutputs } from './plan-outputs.ts';

describe('planOutputs', () => {
  test('a non-private file plans its own path', () => {
    assert.deepEqual(planOutputs({ staticFiles: [{ path: 'about/index.html', private: false }] }), [
      { source: 'about/index.html', output: 'about/index.html' },
    ]);
  });

  test('a private file plans nothing', () => {
    assert.deepEqual(planOutputs({ staticFiles: [{ path: '_private.txt', private: true }] }), []);
  });

  test('outputs come back sorted by output path whatever the input order', () => {
    const files = [
      { path: 'styles/site.css', private: false },
      { path: 'index.html', private: false },
      { path: '.htaccess', private: false },
      { path: 'about/index.html', private: false },
    ];
    assert.deepEqual(planOutputs({ staticFiles: files }).map((output) => output.output), [
      '.htaccess',
      'about/index.html',
      'index.html',
      'styles/site.css',
    ]);
  });

  test('two files planning one output path fail naming both', () => {
    const files = [
      { path: 'index.html', private: false },
      { path: 'about/index.html', private: false },
      { path: 'index.html', private: false },
    ];
    assert.throws(() => planOutputs({ staticFiles: files }), {
      message: 'Both index.html and index.html would be written to index.html.',
    });
  });
});
