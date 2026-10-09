// spec: docs/specs/build.md

import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Output } from '../plugins/handle-files.ts';
import type { EmittedOutput } from '../plugins/produce-files.ts';
import { compareStrings } from '../shared/compare-strings.ts';
import type { RenderedPage } from '../templates/render-pages.ts';
import type { Reporter } from './bind-reporter.ts';
import { runUnits } from './run-units.ts';
import type { Unit } from './run-units.ts';

interface PlannedFile {
  sourcePath: string;
  outputPath: string;
  hash: string;
}

const comparePlannedFiles = (a: PlannedFile, b: PlannedFile): number =>
  compareStrings(a.outputPath, b.outputPath) || compareStrings(a.sourcePath, b.sourcePath);

// Sorted, so a collision names its two sources the same way whichever order
// they arrived in.
// spec: docs/specs/source-tree.md, Output paths are unique
const planFiles = (files: PlannedFile[]): PlannedFile[] => {
  const planned: PlannedFile[] = files.map(({ sourcePath, outputPath, hash }) => ({ sourcePath, outputPath, hash })).sort(comparePlannedFiles);
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
// forgetting what was written at or under it and reporting a directory with
// a trailing slash.
const clean = async (
  directory: string,
  prefix: string,
  files: Set<string>,
  directories: Set<string>,
  present: Set<string>,
  written: Map<string, string>,
  reporter: Reporter,
): Promise<void> => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory() && directories.has(path)) {
      await clean(absolute, `${path}/`, files, directories, present, written, reporter);
    } else if (entry.isFile() && files.has(path)) {
      present.add(path);
    } else {
      await rm(absolute, { recursive: true });
      for (const writtenPath of written.keys()) {
        if (writtenPath === path || writtenPath.startsWith(`${path}/`)) {
          written.delete(writtenPath);
        }
      }
      reporter.removed(entry.isDirectory() ? `${path}/` : path);
    }
  }
};

/**
 * After a successful run the destination holds exactly the public outputs,
 * the public emitted outputs, and the pages. A file being replaced stays until
 * its output overwrites it. A file in place whose hash is the one last written
 * there is left alone, and `written` is kept true to the disk across builds.
 * An emitted output's bytes are dropped once it is in place.
 */
// spec: docs/specs/source-tree.md, Underscore prefix
export const writeDestination = async (
  source: string,
  destination: string,
  outputs: Output[],
  emitted: EmittedOutput[],
  pages: RenderedPage[],
  written: Map<string, string>,
  reporter: Reporter,
): Promise<void> => {
  // An output path with a segment starting with an underscore is never written.
  const isPublic = ({ outputPath }: { outputPath: string }): boolean => !outputPath.split('/').some((segment) => segment.startsWith('_'));
  const publicOutputs = outputs.filter(isPublic);
  const publicEmitted = emitted.filter(isPublic);
  const planned = planFiles([...publicOutputs, ...publicEmitted, ...pages]);
  await mkdir(destination, { recursive: true });
  const present = new Set<string>();
  await clean(destination, '', new Set(planned.map((file) => file.outputPath)), collectDirectories(planned), present, written, reporter);
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
    reporter.wrote(outputPath);
  };
  await runUnits([
    ...publicOutputs.map((output) => place(output, (target) => {
      if (output.contents === undefined) {
        return copyFile(join(source, output.sourcePath), target);
      }
      return writeFile(target, output.contents);
    })),
    ...publicEmitted.map((output): Unit => async () => {
      await place(output, (target) => {
        // Only a file found whole in the destination is reused without its bytes.
        if (output.contents === undefined) {
          throw new Error(`${output.outputPath} was produced in an earlier build and is missing from the destination, so it cannot be written again.`);
        }
        return writeFile(target, output.contents);
      })();
      output.contents = undefined;
    }),
    ...pages.map((page) => place(page, (target) => writeFile(target, page.contents))),
  ]);
};
