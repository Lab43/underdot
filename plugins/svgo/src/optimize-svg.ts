// spec: docs/specs/svgo.md

import { optimize } from 'svgo';
import type { Config } from 'svgo';
import type { HandledFile, HandlerOutput } from 'underdot';

/**
 * The file optimized with svgo, at its own path, with svgo's output as it is.
 */
export const optimizeSvg = (file: HandledFile, config: Config): HandlerOutput[] => {
  // The path is what makes a parser error name the file and the line, and
  // what a path-keyed plugin derives its prefix from.
  const { data } = optimize(file.contents.toString('utf8'), { ...config, path: file.outputPath });
  return [{ outputPath: file.outputPath, contents: data }];
};
