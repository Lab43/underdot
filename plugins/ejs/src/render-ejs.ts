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
  const render = (text: string, fileContext: RenderContext): string => {
    const { sourcePath, variables } = fileContext;
    const directory = dirname(sourcePath);

    // A partial renders as the file being rendered, so an include inside it
    // resolves against the partial's directory, not the including file's.
    // spec: docs/specs/templates.md, Relative paths
    const include = (reference: string, data: Variables = {}): string => {
      const file = extname(reference) === '' ? `${reference}.ejs` : reference;
      const candidates = file.startsWith('/') ? [file] : [directory, ...views].map((base) => `/${join(base, file)}`);
      for (const candidate of candidates) {
        const partial = fileContext.readFile(candidate);
        if (partial !== undefined) {
          return render(partial, fileContext.enterFile(candidate, data));
        }
      }
      if (file.startsWith('/')) {
        throw new Error(`No include ${reference} is under the source root.`);
      }
      throw new Error(`No include ${reference} is in ${directory === '.' ? 'the source root' : directory} or in the views directories.`);
    };

    // Where a `var` a scriptlet sets lands, so the context's variables are
    // never written.
    const assignments: Variables = {};
    // What EJS's `with` block resolves a name to.
    const locals = new Proxy(assignments, {
      has: (target, key) => {
        if (key === 'include') {
          return true;
        }
        // EJS's own names always reach EJS.
        if (ejsNames.has(key)) {
          return false;
        }
        if (Object.hasOwn(target, key) || Object.hasOwn(variables, key)) {
          return true;
        }
        // A name no file set reads as undefined, unless the runtime has it.
        return !(key in globalThis);
      },
      get: (target, key): unknown => {
        if (key === 'include') {
          return include;
        }
        if (Object.hasOwn(target, key)) {
          return Reflect.get(target, key);
        }
        return Reflect.get(variables, key);
      },
      set: (target, key, value) => Reflect.set(target, key, value),
    });
    return ejs.compile(text, { filename: sourcePath, unsafePrototypeLocals: true, legacyInclude: false })(locals);
  };

  return render(body, context);
};
