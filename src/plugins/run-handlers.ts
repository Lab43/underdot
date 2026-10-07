// spec: docs/specs/plugins.md, File handlers

import type { FileTable } from '../build/hash-files.ts';
import type { Observe } from '../build/reuse-unit.ts';
import { isPlainPath } from '../shared/is-plain-path.ts';
import { matchGlob } from '../shared/match-glob.ts';
import { attributePluginError } from './attribute-plugin-error.ts';
import { printWarning } from './print-warning.ts';
import type { RegisteredHandler } from './register-plugins.ts';

/**
 * A static file as a handler receives it: its output path as the handlers
 * before it left it, and its contents.
 */
export interface HandledFile {
  outputPath: string;
  contents: Buffer;
}

/**
 * A file a handler returns, with its contents as text or bytes.
 */
export interface HandlerOutput {
  outputPath: string;
  contents: string | Uint8Array;
}

/**
 * What a handler receives beside the file.
 */
export interface HandlerContext {
  /**
   * The absolute path of the source root, where a wrapped tool finds the
   * file and what it imports on disk.
   */
  sourceDirectory: string;
  /**
   * Record a file a wrapped tool read on its own, by its path under the
   * source root, as an input of the handling.
   */
  declareFile: (sourcePath: string) => void;
  /**
   * Print a warning naming the handling and the handler's plugin. The build
   * goes on.
   */
  warn: (message: string) => void;
}

/**
 * Run one file through every handler whose glob matches it, in order. What a
 * handler returns is what the next matching handler receives. A throw or a
 * warning names the source path, the file the author edits, and every file a
 * handler declares is reported to `observe`.
 */
export const runHandlers = async (
  sourcePath: string,
  file: HandledFile,
  handlers: RegisteredHandler[],
  sourceDirectory: string,
  files: FileTable,
  observe: Observe,
): Promise<HandledFile[]> => {
  // A declared file is versioned from the table as a read through the render
  // context is, so one outside the source or excluded cannot be tracked.
  // spec: docs/specs/plugins.md, Reading and writing
  const declareFile = (declaredPath: string): void => {
    if (!isPlainPath(declaredPath)) {
      throw new Error(`The handler declares ${JSON.stringify(declaredPath)}, which is not a plain path under the source root.`);
    }
    if (!files.has(declaredPath)) {
      throw new Error(`The handler declares ${declaredPath}, which the build does not see.`);
    }
    observe('file', declaredPath);
  };
  let handledFiles = [file];
  for (const { pluginName, glob, handle } of handlers) {
    const handled: HandledFile[] = [];
    for (const current of handledFiles) {
      if (!matchGlob(current.outputPath, glob)) {
        handled.push(current);
        continue;
      }
      const warn = (message: string): void => {
        printWarning(`Handling ${sourcePath}`, pluginName, message);
      };
      let outputs: HandlerOutput[];
      // spec: docs/specs/plugins.md, Errors
      try {
        outputs = await handle(current, { sourceDirectory, declareFile, warn });
      } catch (error) {
        throw attributePluginError(`Handling ${sourcePath}`, pluginName, error);
      }
      if (!Array.isArray(outputs)) {
        throw new Error(`The handler ${pluginName} registers for ${glob} must return an array of files.`);
      }
      for (const { outputPath, contents } of outputs) {
        // A returned path is plain, and its contents are text or bytes.
        if (!isPlainPath(outputPath)) {
          throw new Error(`The handler ${pluginName} registers for ${glob} returned a file at ${JSON.stringify(outputPath)}, which is not a plain path under the destination.`);
        }
        if (typeof contents !== 'string' && !(contents instanceof Uint8Array)) {
          throw new Error(`The handler ${pluginName} registers for ${glob} returned ${outputPath} with contents that are neither text nor bytes.`);
        }
        handled.push({ outputPath, contents: Buffer.from(contents) });
      }
    }
    handledFiles = handled;
  }
  return handledFiles;
};
