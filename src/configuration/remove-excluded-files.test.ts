// spec: q-docs/specs/configuration.md, Excluded files

import { describe, expect, test } from 'vitest';
import { removeExcludedFiles } from './remove-excluded-files.ts';

describe('removeExcludedFiles', () => {
  test('a pattern matches a dotfile at the root, in a subdirectory, and in a dot-directory', () => {
    const paths = ['.DS_Store', 'a/.DS_Store', '.well-known/.DS_Store', '.a/.b/.DS_Store', 'index.html', 'a/b.txt'];
    expect(removeExcludedFiles(paths, ['**/.DS_Store'])).toStrictEqual(['index.html', 'a/b.txt']);
  });

  test('an extension pattern matches a dotfile and a file inside a dot-directory', () => {
    const paths = ['note.draft', '.hidden.draft', '.hidden/h.draft', 'note.txt'];
    expect(removeExcludedFiles(paths, ['**/*.draft'])).toStrictEqual(['note.txt']);
  });

  test('a directory glob drops the files under the directory, and its bare name drops nothing', () => {
    const paths = ['drafts/plan.txt', 'drafts/x/y.md', 'index.html'];
    expect(removeExcludedFiles(paths, ['drafts/**'])).toStrictEqual(['index.html']);
    expect(removeExcludedFiles(paths, ['drafts'])).toStrictEqual(paths);
  });

  test('an empty pattern list keeps everything', () => {
    const paths = ['.DS_Store', 'index.html'];
    expect(removeExcludedFiles(paths, [])).toStrictEqual(paths);
  });
});
