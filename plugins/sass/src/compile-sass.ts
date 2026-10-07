// spec: docs/specs/sass.md

import { join, relative, sep } from 'node:path';
import { basename } from 'node:path/posix';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileStringAsync } from 'sass';
import type { HandledFile, HandlerContext, HandlerOutput } from 'underdot';

/**
 * The stylesheet compiled to CSS beside itself, or nothing for a partial.
 * Every file Sass loaded for it is declared, and Sass's warnings and debug
 * output go to the build.
 */
export const compileSass = async (file: HandledFile, context: HandlerContext): Promise<HandlerOutput[]> => {
  if (basename(file.outputPath).startsWith('_')) {
    return [];
  }
  // The path on disk is what relative imports resolve against and what
  // Sass's reports name.
  const url = pathToFileURL(join(context.sourceDirectory, file.outputPath));
  const result = await compileStringAsync(file.contents.toString('utf8'), {
    url,
    loadPaths: [context.sourceDirectory],
    logger: {
      warn: (message, { stack }) => {
        if (stack === undefined) {
          context.warn(message);
          return;
        }
        context.warn(`${message}\n${stack.trimEnd()}`);
      },
      // Written in the format of a warning's stack, relative to the working
      // directory as Sass writes it.
      debug: (message, { span }) => {
        const loadedPath = fileURLToPath(span.url ?? url);
        const line = String(span.start.line + 1);
        const column = String(span.start.column + 1);
        context.warn(`${message}\n${relative(process.cwd(), loadedPath)} ${line}:${column}`);
      },
    },
  });
  // The stylesheet itself is already its unit's input, and after a rename or
  // an emit its path is not a source path.
  for (const loadedUrl of result.loadedUrls) {
    if (loadedUrl.href === url.href) {
      continue;
    }
    const loadedPath = relative(context.sourceDirectory, fileURLToPath(loadedUrl));
    // Source paths are posix whatever the platform.
    context.declareFile(loadedPath.split(sep).join('/'));
  }
  return [{ outputPath: file.outputPath.replace(/\.scss$/, '.css'), contents: result.css }];
};
