// spec: docs/specs/templates.md, Data files

import type { RegisteredHelper } from '../plugins/register-plugins.ts';
import type { DataVariable } from './read-data.ts';

/**
 * The configuration's globals with every data variable added under its name.
 */
export const defineGlobals = (
  globals: Record<string, unknown>,
  dataVariables: DataVariable[],
  helpers: ReadonlyMap<string, RegisteredHelper>,
): Record<string, unknown> => {
  const defined = { ...globals };
  for (const { name, sourcePath, value } of dataVariables) {
    if (Object.hasOwn(globals, name)) {
      throw new Error(`Both the globals setting and ${sourcePath} define ${name}.`);
    }
    defined[name] = value;
  }
  // A helper is reachable under its name, so no global may carry it.
  // spec: docs/specs/plugins.md, Template helpers
  for (const [name, { pluginName }] of helpers) {
    if (Object.hasOwn(globals, name)) {
      throw new Error(`Both the globals setting and the plugin ${pluginName} define ${name}.`);
    }
    const dataVariable = dataVariables.find((variable) => variable.name === name);
    if (dataVariable !== undefined) {
      throw new Error(`Both ${dataVariable.sourcePath} and the plugin ${pluginName} define ${name}.`);
    }
  }
  return defined;
};
