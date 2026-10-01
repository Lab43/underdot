// spec: docs/specs/build.md, Destination

import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { StaticFile } from '../source-tree/classify-source.ts';
import type { RenderedPage } from '../templates/render-pages.ts';
import { runUnits } from './run-units.ts';

interface Output {
  sourcePath: string;
  outputPath: string;
}

// Compare by character code rather than by locale, so every machine sorts alike.
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const compareOutputs = (a: Output, b: Output): number =>
  compare(a.outputPath, b.outputPath) || compare(a.sourcePath, b.sourcePath);

// Sorted, so a collision names its two sources the same way whichever order
// they arrived in.
// spec: docs/specs/source-tree.md
const collectOutputs = (staticFiles: StaticFile[], pages: RenderedPage[]): Output[] => {
  const outputs = [
    ...staticFiles.filter((file) => !file.private).map(({ sourcePath }) => ({ sourcePath, outputPath: sourcePath })),
    ...pages.map(({ sourcePath, outputPath }) => ({ sourcePath, outputPath })),
  ].sort(compareOutputs);
  const sourcePaths = new Map<string, string>();
  for (const { sourcePath, outputPath } of outputs) {
    const other = sourcePaths.get(outputPath);
    if (other !== undefined) {
      throw new Error(`Both ${other} and ${sourcePath} would be written to ${outputPath}.`);
    }
    sourcePaths.set(outputPath, sourcePath);
  }
  return outputs;
};

// Every directory the outputs pass through, as a path under the destination
// with forward slashes.
const collectOutputDirectories = (outputs: Output[]): Set<string> => {
  const directories = new Set<string>();
  for (const { outputPath } of outputs) {
    const segments = outputPath.split('/');
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

// After a successful run the destination holds exactly the outputs. A file
// being replaced stays until its output overwrites it.
export const writeDestination = async (source: string, destination: string, staticFiles: StaticFile[], pages: RenderedPage[]): Promise<void> => {
  const outputs = collectOutputs(staticFiles, pages);
  await mkdir(destination, { recursive: true });
  await clean(destination, '', new Set(outputs.map((output) => output.outputPath)), collectOutputDirectories(outputs));
  const placeOutput = async (outputPath: string): Promise<string> => {
    const target = join(destination, outputPath);
    await mkdir(dirname(target), { recursive: true });
    return target;
  };
  await runUnits([
    ...staticFiles.filter((file) => !file.private).map((file) => async () => {
      await copyFile(join(source, file.sourcePath), await placeOutput(file.sourcePath));
    }),
    ...pages.map((page) => async () => {
      await writeFile(await placeOutput(page.outputPath), page.contents);
    }),
  ]);
};
