// spec: docs/specs/source-tree.md, Dotfiles

import { describe, expect, test } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { walkSource } from './walk-source.ts';

describe('walkSource', () => {
  test('lists every file with forward slashes, dotfiles and underscore-prefixed paths included, sorted', async () => {
    expect(await walkSource(fixturePath('defaults/source'))).toStrictEqual([
      '.DS_Store',
      '.htaccess',
      '.well-known/.DS_Store',
      '.well-known/security.txt',
      '_includes/header.html',
      '_private.txt',
      'about/.DS_Store',
      'about/index.html',
      'about/team.txt',
      'index.html',
      'litter/.DS_Store',
      'styles/site.css',
    ]);
  });

  test('a root that does not exist is named', async () => {
    const root = fixturePath('defaults/content');
    await expect(walkSource(root)).rejects.toThrow(new Error(`The source root ${root} does not exist.`));
  });

  test('a root that is a file is named', async () => {
    const root = fixturePath('defaults/source/index.html');
    await expect(walkSource(root)).rejects.toThrow(new Error(`The source root ${root} is not a directory.`));
  });

  test('a failure other than a missing root propagates as raised', async () => {
    await expect(walkSource(fixturePath('defaults/source/index.html/nope'))).rejects.toMatchObject({ code: 'ENOTDIR' });
  });

  test('a symlink is neither a file nor a directory', async () => {
    await expect(walkSource(fixturePath('symlinked/source'))).rejects.toThrow(
      new Error('The source entry link.txt is neither a file nor a directory.'),
    );
  });
});
