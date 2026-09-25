// spec: docs/specs/configuration.md, Excluded files

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { removeExcludedFiles } from './remove-excluded-files.ts';

describe('removeExcludedFiles', () => {
  test('a pattern matches a dotfile at the root, in a subdirectory, and in a dot-directory', () => {
    const paths = ['.DS_Store', 'a/.DS_Store', '.well-known/.DS_Store', '.a/.b/.DS_Store', 'index.html', 'a/b.txt'];
    assert.deepEqual(removeExcludedFiles(paths, ['**/.DS_Store']), ['index.html', 'a/b.txt']);
  });

  test('an extension pattern matches a dotfile and a file inside a dot-directory', () => {
    const paths = ['note.draft', '.hidden.draft', '.hidden/h.draft', 'note.txt'];
    assert.deepEqual(removeExcludedFiles(paths, ['**/*.draft']), ['note.txt']);
  });

  test('a directory glob drops the files under the directory, and its bare name drops nothing', () => {
    const paths = ['drafts/plan.txt', 'drafts/x/y.md', 'index.html'];
    assert.deepEqual(removeExcludedFiles(paths, ['drafts/**']), ['index.html']);
    assert.deepEqual(removeExcludedFiles(paths, ['drafts']), paths);
  });

  test('an empty pattern list keeps everything', () => {
    const paths = ['.DS_Store', 'index.html'];
    assert.deepEqual(removeExcludedFiles(paths, []), paths);
  });
});
