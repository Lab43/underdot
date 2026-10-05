// spec: docs/specs/plugins.md

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Source paths are posix whatever the platform, and only the disk read
// takes a platform path.
import { dirname, join as joinPosix } from 'node:path/posix';
import type { Output } from './handle-files.ts';
import type { RegisteredHelper } from './register-plugins.ts';

/**
 * What a renderer or helper receives for the file being rendered, the page's
 * path during its render and the template's during a template's.
 */
export interface RenderContext {
  sourcePath: string;
  /**
   * The merged variables, with every registered helper among them under its
   * name, bound to this context.
   */
  variables: Record<string, unknown>;
  /**
   * The text of the file a reference names, a path relative to this file or
   * absolute from the source root, or no value when no file is there.
   */
  readFile: (reference: string) => string | undefined;
  /**
   * The handled output at the path a reference names, resolved as a file read
   * is, or no value when no static file's output is there. The bytes are the
   * ones the build writes, so a reader never changes them.
   */
  readOutput: (reference: string) => Buffer | undefined;
  /**
   * Another page's rendered body, by its URL. Only a template may read one.
   */
  readBody: (url: string) => string;
  /**
   * The context of a file this renderer renders in place of this one, a
   * partial, with the variables it renders with. A reference no file is at is
   * an error, since a renderer enters a file it has already read.
   */
  enterFile: (reference: string, variables: Record<string, unknown>) => RenderContext;
}

/**
 * Makes the context for one file. The bodies are those rendered so far, and
 * none while a page's own body renders.
 */
export type MakeRenderContext = (
  sourcePath: string,
  variables: Record<string, unknown>,
  bodies: ReadonlyMap<string, string> | undefined,
) => RenderContext;

/**
 * Bind what the build lends every render. The result makes a context per file.
 */
export const bindRenderContext = (
  source: string,
  sourcePaths: ReadonlySet<string>,
  helpers: ReadonlyMap<string, RegisteredHelper>,
  outputs: Output[],
): MakeRenderContext => {
  // The last output of a path, the only one there is once the write succeeds.
  const outputsByPath = new Map(outputs.map((output) => [output.outputPath, output]));
  const makeContext: MakeRenderContext = (sourcePath, variables, bodies) => {
    // A relative reference resolves against the file's directory and an
    // absolute one against the source root.
    // spec: docs/specs/templates.md, Relative paths
    const resolve = (reference: string): string => {
      const referencedPath = joinPosix(reference.startsWith('/') ? '.' : dirname(sourcePath), reference);
      if (referencedPath === '..' || referencedPath.startsWith('../')) {
        throw new Error(`${sourcePath} reads ${reference}, which is above the source root.`);
      }
      return referencedPath;
    };

    const readFile = (reference: string): string | undefined => {
      const referencedPath = resolve(reference);
      // A file the walk did not see, an excluded one among them, is absent.
      // spec: docs/specs/configuration.md, Excluded files
      if (!sourcePaths.has(referencedPath)) {
        return undefined;
      }
      return readFileSync(join(source, referencedPath), 'utf8');
    };

    const readOutput = (reference: string): Buffer | undefined => {
      const output = outputsByPath.get(resolve(reference));
      if (output === undefined) {
        return undefined;
      }
      return output.contents ?? readFileSync(join(source, output.sourcePath));
    };

    const readBody = (url: string): string => {
      if (bodies === undefined) {
        throw new Error(`${sourcePath} reads the body of ${url} while its own body renders, which only a template can do.`);
      }
      const body = bodies.get(url);
      if (body === undefined) {
        throw new Error(`${sourcePath} reads the body of ${url}, but no page has that URL.`);
      }
      return body;
    };

    const enterFile = (reference: string, enteredVariables: Record<string, unknown>): RenderContext => {
      const referencedPath = resolve(reference);
      if (!sourcePaths.has(referencedPath)) {
        throw new Error(`${sourcePath} enters ${reference}, but no file is there.`);
      }
      return makeContext(referencedPath, enteredVariables, bodies);
    };

    // A helper's name wins over a variable handed in under it.
    const contextVariables = { ...variables };
    const context: RenderContext = { sourcePath, variables: contextVariables, readFile, readOutput, readBody, enterFile };
    for (const [name, { helper }] of helpers) {
      contextVariables[name] = (...args: unknown[]): unknown => helper(context, ...args);
    }
    return context;
  };
  return makeContext;
};
