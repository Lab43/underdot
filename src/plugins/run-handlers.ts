// spec: docs/specs/plugins.md, File handlers

import { matchGlob } from '../shared/match-glob.ts';
import { attributePluginError } from './attribute-plugin-error.ts';
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
 * Run one file through every handler whose glob matches it, in order. What a
 * handler returns is what the next matching handler receives. A throw names
 * the source path, the file the author edits.
 */
export const runHandlers = async (sourcePath: string, file: HandledFile, handlers: RegisteredHandler[]): Promise<HandledFile[]> => {
  let files = [file];
  for (const { pluginName, glob, handle } of handlers) {
    const handled: HandledFile[] = [];
    for (const current of files) {
      if (!matchGlob(current.outputPath, glob)) {
        handled.push(current);
        continue;
      }
      let outputs: HandlerOutput[];
      // spec: docs/specs/plugins.md, Errors
      try {
        outputs = await handle(current);
      } catch (error) {
        throw attributePluginError(`Handling ${sourcePath}`, pluginName, error);
      }
      if (!Array.isArray(outputs)) {
        throw new Error(`The handler ${pluginName} registers for ${glob} must return an array of files.`);
      }
      for (const { outputPath, contents } of outputs) {
        // A returned path is plain, and its contents are text or bytes.
        if (typeof outputPath !== 'string' || outputPath.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
          throw new Error(`The handler ${pluginName} registers for ${glob} returned a file at ${JSON.stringify(outputPath)}, which is not a plain path under the destination.`);
        }
        if (typeof contents !== 'string' && !(contents instanceof Uint8Array)) {
          throw new Error(`The handler ${pluginName} registers for ${glob} returned ${outputPath} with contents that are neither text nor bytes.`);
        }
        handled.push({ outputPath, contents: Buffer.from(contents) });
      }
    }
    files = handled;
  }
  return files;
};
