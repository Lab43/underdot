// spec: docs/specs/build.md, Destination

import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Output } from '../plugins/handle-files.ts';
import type { RenderedPage } from '../templates/render-pages.ts';
import { runUnits } from './run-units.ts';

interface PlannedFile {
  sourcePath: string;
  outputPath: string;
}

// Compare by character code rather than by locale, so every machine sorts alike.
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const comparePlannedFiles = (a: PlannedFile, b: PlannedFile): number =>
  compare(a.outputPath, b.outputPath) || compare(a.sourcePath, b.sourcePath);

// Sorted, so a collision names its two sources the same way whichever order
// they arrived in.
// spec: docs/specs/source-tree.md, Output paths are unique
const planFiles = (outputs: Output[], pages: RenderedPage[]): PlannedFile[] => {
  const planned: PlannedFile[] = [...outputs, ...pages].map(({ sourcePath, outputPath }) => ({ sourcePath, outputPath })).sort(comparePlannedFiles);
  const sourcePaths = new Map<string, string>();
  for (const { sourcePath, outputPath } of planned) {
    const other = sourcePaths.get(outputPath);
    if (other === sourcePath) {
      throw new Error(`${sourcePath} would be written to ${outputPath} twice.`);
    }
    if (other !== undefined) {
      throw new Error(`Both ${other} and ${sourcePath} would be written to ${outputPath}.`);
    }
    sourcePaths.set(outputPath, sourcePath);
  }
  return planned;
};

// Every directory the planned files pass through, as a path under the
// destination with forward slashes.
const collectDirectories = (planned: PlannedFile[]): Set<string> => {
  const directories = new Set<string>();
  for (const { outputPath } of planned) {
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

/**
 * After a successful run the destination holds exactly the public outputs and
 * the pages. A file being replaced stays until its output overwrites it.
 */
// spec: docs/specs/source-tree.md, Underscore prefix
export const writeDestination = async (source: string, destination: string, outputs: Output[], pages: RenderedPage[]): Promise<void> => {
  // An output path with a segment starting with an underscore is never written.
  const publicOutputs = outputs.filter(({ outputPath }) => !outputPath.split('/').some((segment) => segment.startsWith('_')));
  const planned = planFiles(publicOutputs, pages);
  await mkdir(destination, { recursive: true });
  await clean(destination, '', new Set(planned.map((file) => file.outputPath)), collectDirectories(planned));
  const placeOutput = async (outputPath: string): Promise<string> => {
    const target = join(destination, outputPath);
    await mkdir(dirname(target), { recursive: true });
    return target;
  };
  await runUnits([
    ...publicOutputs.map((output) => async () => {
      const target = await placeOutput(output.outputPath);
      if (output.contents === undefined) {
        await copyFile(join(source, output.sourcePath), target);
      } else {
        await writeFile(target, output.contents);
      }
    }),
    ...pages.map((page) => async () => {
      await writeFile(await placeOutput(page.outputPath), page.contents);
    }),
  ]);
};
