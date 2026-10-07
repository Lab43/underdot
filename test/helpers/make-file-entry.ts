import type { FileEntry } from '../../src/build/hash-files.ts';

// A file table entry whose version is the hash given.
export const makeFileEntry = (hash: string): FileEntry => ({ mtimeNs: 1n, size: 1n, hash });
