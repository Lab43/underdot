// spec: docs/specs/build.md, Destination

import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Output } from '../source-tree/plan-outputs.ts';
import { runUnits } from './run-units.ts';

// Every directory the outputs pass through, as a path under the destination
// with forward slashes.
const collectOutputDirectories = (outputs: Output[]): Set<string> => {
  const directories = new Set<string>();
  for (const { output } of outputs) {
    const segments = output.split('/');
    for (let depth = 1; depth < segments.length; depth += 1) {
      directories.add(segments.slice(0, depth).join('/'));
    }
  }
  return directories;
};

// Clean a directory top-down: descend a planned directory, keep a regular
// file at a planned path, and remove everything else.
const clean = async (directory: string, prefix: string, files: Set<string>, directories: Set<string>): Promise<void> => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory() && directories.has(path)) {
      await clean(absolute, `${path}/`, files, directories);
    } else if (!(entry.isFile() && files.has(path))) {
      await rm(absolute, { recursive: true });
    }
  }
};

// After a successful run the destination holds exactly the planned outputs.
// A file being replaced stays until its copy overwrites it.
export const writeDestination = async (source: string, destination: string, outputs: Output[]): Promise<void> => {
  await mkdir(destination, { recursive: true });
  await clean(destination, '', new Set(outputs.map((output) => output.output)), collectOutputDirectories(outputs));
  await runUnits(outputs.map((output) => async () => {
    const target = join(destination, output.output);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(source, output.source), target);
  }));
};
