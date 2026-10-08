// spec: docs/specs/postcss.md

import { realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { Processor } from 'postcss';
import type { HandledFile, HandlerContext, HandlerOutput } from 'underdot';

/**
 * Run a CSS file through the processor, declaring every file its plugins
 * reported reading and passing on every warning they gave.
 */
export const processCss = async (file: HandledFile, context: HandlerContext, processor: Processor): Promise<HandlerOutput[]> => {
  // The path on disk is what relative imports and Browserslist's search start
  // from, and what PostCSS's reports name.
  const absolutePath = join(context.sourceDirectory, file.outputPath);
  const result = await processor.process(file.contents.toString('utf8'), { from: absolutePath, to: absolutePath, map: false });
  // A plugin may report a dependency by its real path, as postcss-import does,
  // so both sides are compared with every symlink resolved.
  const realSourceDirectory = await realpath(context.sourceDirectory);
  for (const message of result.messages) {
    if (message.type === 'dependency') {
      const reportedPath: unknown = message.file;
      const dependencyPath = await realpath(String(reportedPath));
      // Source paths are posix whatever the platform.
      context.declareFile(relative(realSourceDirectory, dependencyPath).split(sep).join('/'));
    }
    if (message.type === 'dir-dependency') {
      const directory: unknown = message.dir;
      throw new Error(`PostCSS reports a dependency on the directory ${String(directory)}, which the build cannot track.`);
    }
  }
  for (const warning of result.warnings()) {
    context.warn(warning.toString());
  }
  return [{ outputPath: file.outputPath, contents: result.css }];
};
