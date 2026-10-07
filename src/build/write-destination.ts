// spec: docs/specs/build.md

import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Output } from '../plugins/handle-files.ts';
import type { RenderedPage } from '../templates/render-pages.ts';
import { runUnits } from './run-units.ts';
import type { Unit } from './run-units.ts';

interface PlannedFile {
  sourcePath: string;
  outputPath: string;
  hash: string;
}

// Compare by character code rather than by locale, so every machine sorts alike.
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const comparePlannedFiles = (a: PlannedFile, b: PlannedFile): number =>
  compare(a.outputPath, b.outputPath) || compare(a.sourcePath, b.sourcePath);

// Sorted, so a collision names its two sources the same way whichever order
// they arrived in.
// spec: docs/specs/source-tree.md, Output paths are unique
const planFiles = (outputs: Output[], pages: RenderedPage[]): PlannedFile[] => {
  const planned: PlannedFile[] = [...outputs, ...pages].map(({ sourcePath, outputPath, hash }) => ({ sourcePath, outputPath, hash })).sort(comparePlannedFiles);
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
// file at a planned path, noting it as present, and remove everything else,
// forgetting what was written at or under it.
const clean = async (
  directory: string,
  prefix: string,
  files: Set<string>,
  directories: Set<string>,
  present: Set<string>,
  written: Map<string, string>,
): Promise<void> => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory() && directories.has(path)) {
      await clean(absolute, `${path}/`, files, directories, present, written);
    } else if (entry.isFile() && files.has(path)) {
      present.add(path);
    } else {
      await rm(absolute, { recursive: true });
      for (const writtenPath of written.keys()) {
        if (writtenPath === path || writtenPath.startsWith(`${path}/`)) {
          written.delete(writtenPath);
        }
      }
    }
  }
};

/**
 * After a successful run the destination holds exactly the public outputs and
 * the pages. A file being replaced stays until its output overwrites it. A
 * file in place whose hash is the one last written there is left alone, and
 * `written` is kept true to the disk across builds.
 */
// spec: docs/specs/source-tree.md, Underscore prefix
export const writeDestination = async (
  source: string,
  destination: string,
  outputs: Output[],
  pages: RenderedPage[],
  written: Map<string, string>,
): Promise<void> => {
  // An output path with a segment starting with an underscore is never written.
  const publicOutputs = outputs.filter(({ outputPath }) => !outputPath.split('/').some((segment) => segment.startsWith('_')));
  const planned = planFiles(publicOutputs, pages);
  await mkdir(destination, { recursive: true });
  const present = new Set<string>();
  await clean(destination, '', new Set(planned.map((file) => file.outputPath)), collectDirectories(planned), present, written);
  // The entry is deleted before the write and set after it, so a write that
  // fails leaves no entry claiming the file is whole.
  const place = ({ outputPath, hash }: PlannedFile, write: (target: string) => Promise<void>): Unit => async () => {
    if (present.has(outputPath) && written.get(outputPath) === hash) {
      return;
    }
    written.delete(outputPath);
    const target = join(destination, outputPath);
    await mkdir(dirname(target), { recursive: true });
    await write(target);
    written.set(outputPath, hash);
  };
  await runUnits([
    ...publicOutputs.map((output) => place(output, (target) => {
      if (output.contents === undefined) {
        return copyFile(join(source, output.sourcePath), target);
      }
      return writeFile(target, output.contents);
    })),
    ...pages.map((page) => place(page, (target) => writeFile(target, page.contents))),
  ]);
};
