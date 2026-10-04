// spec: docs/specs/ejs.md

import { dirname, extname, join } from 'node:path/posix';
import ejs from 'ejs';
import type { RenderContext } from 'underdot';

type Variables = Record<string, unknown>;

// The names EJS's generated code reaches from inside its `with` block.
const ejsNames: ReadonlySet<PropertyKey> = new Set(['__append', '__line', 'escapeFn', 'locals']);

/**
 * Render an EJS body with the context's variables. An include resolves
 * through the context, in the including file's directory and then the views.
 */
export const renderEjs = (body: string, context: RenderContext, views: string[]): string => {
  const render = (text: string, sourcePath: string, variables: Variables): string => {
    const directory = dirname(sourcePath);

    // An include inside a partial resolves against the partial's directory,
    // not the including file's.
    // spec: docs/specs/templates.md, Relative paths
    const include = (reference: string, data: Variables = {}): string => {
      const file = extname(reference) === '' ? `${reference}.ejs` : reference;
      const candidates = file.startsWith('/') ? [file] : [directory, ...views].map((base) => `/${join(base, file)}`);
      for (const candidate of candidates) {
        const partial = context.readFile(candidate);
        if (partial !== undefined) {
          return render(partial, candidate.slice(1), { ...variables, ...data });
        }
      }
      if (file.startsWith('/')) {
        throw new Error(`No include ${reference} is under the source root.`);
      }
      throw new Error(`No include ${reference} is in ${directory === '.' ? 'the source root' : directory} or in the views directories.`);
    };

    // A name no file set reads as undefined, a runtime global stays reachable
    // unless a variable shares its name, and EJS's own names always reach EJS.
    // The copy keeps a `var` assignment off the caller's object.
    const copy = { ...variables };
    const locals = new Proxy(copy, {
      has: (target, key) => key === 'include' || (!ejsNames.has(key) && (Object.hasOwn(target, key) || !(key in globalThis))),
      get: (target, key): unknown => (key === 'include' ? include : Reflect.get(target, key)),
    });
    return ejs.compile(text, { filename: sourcePath, unsafePrototypeLocals: true, legacyInclude: false })(locals);
  };

  return render(body, context.sourcePath, context.variables);
};
