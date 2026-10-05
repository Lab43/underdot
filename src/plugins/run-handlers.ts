// spec: docs/specs/plugins.md, File handlers

import { matchGlob } from '../shared/match-glob.ts';
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
 * handler returns is what the next matching handler receives.
 */
export const runHandlers = async (file: HandledFile, handlers: RegisteredHandler[]): Promise<HandledFile[]> => {
  let files = [file];
  for (const { pluginName, glob, handle } of handlers) {
    const handled: HandledFile[] = [];
    for (const current of files) {
      if (!matchGlob(current.outputPath, glob)) {
        handled.push(current);
        continue;
      }
      const outputs = await handle(current);
      if (!Array.isArray(outputs)) {
        throw new Error(`The handler ${pluginName} registers for ${glob} must return an array of files.`);
      }
      for (const { outputPath, contents } of outputs) {
        handled.push({ outputPath, contents: Buffer.from(contents) });
      }
    }
    files = handled;
  }
  return files;
};
