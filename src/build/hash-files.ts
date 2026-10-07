// spec: docs/specs/build.md, Incremental builds

import { hash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { mapUnits } from './map-units.ts';

/**
 * A source file as last seen: the stat fields that say whether it was
 * rewritten, and the hash of its contents.
 */
export interface FileEntry {
  mtimeNs: bigint;
  size: bigint;
  hash: string;
}

/**
 * Every walked file's entry, by source path.
 */
export type FileTable = Map<string, FileEntry>;

/**
 * The table for the paths given. A file whose size and modification time
 * match its entry keeps its hash, and every other file is read and hashed.
 */
export const hashFiles = async (source: string, sourcePaths: string[], table: FileTable): Promise<FileTable> => {
  const entries = await mapUnits(sourcePaths, async (sourcePath): Promise<[string, FileEntry]> => {
    const file = join(source, sourcePath);
    const { mtimeNs, size } = await stat(file, { bigint: true });
    const entry = table.get(sourcePath);
    if (entry?.mtimeNs === mtimeNs && entry.size === size) {
      return [sourcePath, entry];
    }
    return [sourcePath, { mtimeNs, size, hash: hash('sha256', await readFile(file), 'hex') }];
  });
  return new Map(entries);
};
