// spec: q-docs/specs/build.md, Incremental builds

import { readFile, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';
import { test } from '../../test/helpers/test.ts';
import { hashFiles } from './hash-files.ts';

vi.mock('node:fs/promises', { spy: true });

const sourcePaths = ['_data/site.json', 'index.tpl', 'notes.txt', 'styles/site.css'];

describe('hashFiles', () => {
  test.override({ fixture: 'templated' });

  test('every path is read and hashed on an empty table', async ({ directory }) => {
    const source = join(directory, 'source');
    const table = await hashFiles(source, sourcePaths, new Map());
    expect([...table.keys()]).toStrictEqual(sourcePaths);
    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(sourcePaths.length);
    for (const entry of table.values()) {
      expect(entry).toStrictEqual({ mtimeNs: expect.any(BigInt), size: expect.any(BigInt), hash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    expect(table.get('notes.txt')?.size).toBe(16n);
  });

  test('a second call reads nothing and keeps every entry', async ({ directory }) => {
    const source = join(directory, 'source');
    const first = await hashFiles(source, sourcePaths, new Map());
    vi.mocked(readFile).mockClear();
    const second = await hashFiles(source, sourcePaths, first);
    expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
  });

  test('a rewritten file is read again and its hash changes', async ({ directory }) => {
    const source = join(directory, 'source');
    const first = await hashFiles(source, sourcePaths, new Map());
    await writeFile(join(source, 'notes.txt'), 'The notes file, edited.\n');
    vi.mocked(readFile).mockClear();
    const second = await hashFiles(source, sourcePaths, first);
    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(1);
    expect(second.get('notes.txt')?.hash).not.toBe(first.get('notes.txt')?.hash);
    expect(second.get('index.tpl')).toBe(first.get('index.tpl'));
  });

  test('a file given new times is read again and its hash does not change', async ({ directory }) => {
    const source = join(directory, 'source');
    const first = await hashFiles(source, sourcePaths, new Map());
    const later = new Date(Date.now() + 10_000);
    await utimes(join(source, 'notes.txt'), later, later);
    vi.mocked(readFile).mockClear();
    const second = await hashFiles(source, sourcePaths, first);
    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(1);
    expect(second.get('notes.txt')).toStrictEqual({ ...first.get('notes.txt'), mtimeNs: expect.any(BigInt) });
    expect(second.get('notes.txt')?.mtimeNs).not.toBe(first.get('notes.txt')?.mtimeNs);
  });

  test('a path left out of the list is absent from the result', async ({ directory }) => {
    const source = join(directory, 'source');
    const first = await hashFiles(source, sourcePaths, new Map());
    const second = await hashFiles(source, ['index.tpl'], first);
    expect([...second.keys()]).toStrictEqual(['index.tpl']);
  });
});
