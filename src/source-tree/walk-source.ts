// spec: docs/specs/source-tree.md, Dotfiles

import { readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const isMissing = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

// The root must exist and be a directory. Any other failure of stat
// propagates as raised.
const checkRoot = async (root: string): Promise<void> => {
  let stats;
  try {
    stats = await stat(root);
  } catch (error) {
    if (isMissing(error)) {
      throw new Error(`The source root ${root} does not exist.`, { cause: error });
    }
    throw error;
  }
  if (!stats.isDirectory()) {
    throw new Error(`The source root ${root} is not a directory.`);
  }
};

// Every file under the root as its path relative to the root with forward
// slashes, sorted by code unit so the listing is the same on every machine.
export const walkSource = async (root: string): Promise<string[]> => {
  await checkRoot(root);
  // The promise form lists a symlink as neither file nor directory and never
  // descends it, where readdirSync follows a symlinked directory into itself.
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      continue;
    }
    const path = relative(root, join(entry.parentPath, entry.name)).split(sep).join('/');
    if (!entry.isFile()) {
      throw new Error(`The source entry ${path} is neither a file nor a directory.`);
    }
    paths.push(path);
  }
  return paths.sort();
};
