// spec: docs/specs/plugins.md, Render context

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Source paths are posix whatever the platform, and only the disk read
// takes a platform path.
import { dirname, join as joinPosix } from 'node:path/posix';

// What a renderer or helper receives for the file being rendered, the page's
// path during its render and the template's during a template's.
export interface RenderContext {
  sourcePath: string;
  variables: Record<string, unknown>;
  // The text of the file a reference names, a path relative to this file or
  // absolute from the source root, or no value when no file is there.
  readFile: (reference: string) => string | undefined;
  // Another page's rendered body, by its URL. Only a template may read one.
  readBody: (url: string) => string;
}

// Makes the context for one file. The bodies are those rendered so far, and
// none while a page's own body renders.
export type MakeRenderContext = (
  sourcePath: string,
  variables: Record<string, unknown>,
  bodies: ReadonlyMap<string, string> | undefined,
) => RenderContext;

// Bind what the build lends every render. The result makes a context per file.
export const bindRenderContext = (source: string, sourcePaths: ReadonlySet<string>): MakeRenderContext =>
  (sourcePath, variables, bodies) => {
    const readFile = (reference: string): string | undefined => {
      // A relative reference resolves against the file's directory and an
      // absolute one against the source root.
      // spec: docs/specs/templates.md, Relative paths
      const referencedPath = joinPosix(reference.startsWith('/') ? '.' : dirname(sourcePath), reference);
      if (referencedPath === '..' || referencedPath.startsWith('../')) {
        throw new Error(`${sourcePath} reads ${reference}, which is above the source root.`);
      }
      // A file the walk did not see, an excluded one among them, is absent.
      // spec: docs/specs/configuration.md, Excluded files
      if (!sourcePaths.has(referencedPath)) {
        return undefined;
      }
      return readFileSync(join(source, referencedPath), 'utf8');
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

    return { sourcePath, variables, readFile, readBody };
  };
