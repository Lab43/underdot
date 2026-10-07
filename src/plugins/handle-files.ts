// spec: docs/specs/plugins.md, File handlers

import { hash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileTable } from '../build/hash-files.ts';
import { mapUnits } from '../build/map-units.ts';
import { reuseUnit } from '../build/reuse-unit.ts';
import type { InputKind, Observe, UnitRecords, Version } from '../build/reuse-unit.ts';
import { matchGlob } from '../shared/match-glob.ts';
import type { StaticFile } from '../source-tree/classify-source.ts';
import type { RegisteredHandler } from './register-plugins.ts';
import { runHandlers } from './run-handlers.ts';

/**
 * A file the build writes at its output path. No contents means the file is
 * copied from its source path as it stands. The hash is of the bytes written,
 * the source file's for a copy.
 */
export interface Output {
  sourcePath: string;
  outputPath: string;
  contents: Buffer | undefined;
  hash: string;
}

/**
 * The outputs of every static file, in the static files' order. Every file is
 * handled before any page renders, and a file's handling is reused while its
 * hash stands.
 */
// spec: docs/specs/build.md, Order of work
// spec: docs/specs/build.md, Incremental builds
export const handleFiles = async (
  source: string,
  staticFiles: StaticFile[],
  handlers: RegisteredHandler[],
  files: FileTable,
  records: UnitRecords<Output[]>,
): Promise<Output[]> => {
  const lookup = (_kind: InputKind, name: string): Version => files.get(name)?.hash;
  const outputs = await mapUnits(staticFiles, ({ sourcePath }) => {
    const run = async (observe: Observe): Promise<Output[]> => {
      observe('file', sourcePath);
      const entry = files.get(sourcePath);
      if (entry === undefined) {
        throw new Error(`The static file ${sourcePath} was not hashed.`);
      }
      // A chain starts only where a handler matches the file as it sits in
      // source, so a file no handler matches is never read.
      if (!handlers.some(({ glob }) => matchGlob(sourcePath, glob))) {
        return [{ sourcePath, outputPath: sourcePath, contents: undefined, hash: entry.hash }];
      }
      const bytes = await readFile(join(source, sourcePath));
      const handled = await runHandlers(
        sourcePath,
        { outputPath: sourcePath, contents: bytes },
        handlers,
        source,
        files,
        observe,
      );
      return handled.map(({ outputPath, contents }) => ({ sourcePath, outputPath, contents, hash: hash('sha256', contents, 'hex') }));
    };
    return reuseUnit(records, sourcePath, lookup, run);
  });
  return outputs.flat();
};
