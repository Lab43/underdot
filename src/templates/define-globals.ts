// spec: docs/specs/templates.md, Data files

import type { DataVariable } from './read-data.ts';

/**
 * The configuration's globals with every data variable added under its name.
 */
export const defineGlobals = (globals: Record<string, unknown>, dataVariables: DataVariable[]): Record<string, unknown> => {
  const defined = { ...globals };
  for (const { name, sourcePath, value } of dataVariables) {
    if (Object.hasOwn(globals, name)) {
      throw new Error(`Both the globals setting and ${sourcePath} define ${name}.`);
    }
    defined[name] = value;
  }
  return defined;
};
