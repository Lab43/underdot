// spec: docs/specs/plugins.md, File handlers

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mapUnits } from '../build/map-units.ts';
import { matchGlob } from '../shared/match-glob.ts';
import type { StaticFile } from '../source-tree/classify-source.ts';
import type { RegisteredHandler } from './register-plugins.ts';
import { runHandlers } from './run-handlers.ts';

/**
 * A file the build writes at its output path. No contents means the file is
 * copied from its source path as it stands.
 */
export interface Output {
  sourcePath: string;
  outputPath: string;
  contents: Buffer | undefined;
}

/**
 * The outputs of every static file, in the static files' order. Every file is
 * handled before any page renders.
 */
// spec: docs/specs/build.md, Order of work
export const handleFiles = async (source: string, staticFiles: StaticFile[], handlers: RegisteredHandler[]): Promise<Output[]> => {
  const outputs = await mapUnits(staticFiles, async ({ sourcePath }): Promise<Output[]> => {
    // A chain starts only where a handler matches the file as it sits in
    // source, so a file no handler matches is never read.
    if (!handlers.some(({ glob }) => matchGlob(sourcePath, glob))) {
      return [{ sourcePath, outputPath: sourcePath, contents: undefined }];
    }
    const handled = await runHandlers({ outputPath: sourcePath, contents: await readFile(join(source, sourcePath)) }, handlers);
    return handled.map(({ outputPath, contents }) => ({ sourcePath, outputPath, contents }));
  });
  return outputs.flat();
};
