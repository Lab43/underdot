// spec: docs/specs/templates.md, Data files

import type { RegisteredHelper } from '../plugins/register-plugins.ts';
import type { HookGlobal } from '../plugins/run-page-hooks.ts';
import type { DataVariable } from './read-data.ts';

/**
 * The configuration's globals with every data variable and every hook global
 * added under its name.
 */
export const defineGlobals = (
  globals: Record<string, unknown>,
  dataVariables: DataVariable[],
  hookGlobals: HookGlobal[],
  helpers: ReadonlyMap<string, RegisteredHelper>,
): Record<string, unknown> => {
  const defined = { ...globals };
  for (const { name, sourcePath, value } of dataVariables) {
    if (Object.hasOwn(globals, name)) {
      throw new Error(`Both the globals setting and ${sourcePath} define ${name}.`);
    }
    defined[name] = value;
  }
  // A global a hook defines has one home, as every global does.
  // spec: docs/specs/plugins.md, Page hooks
  const hookDefiners = new Map<string, string>();
  for (const { name, pluginName, value } of hookGlobals) {
    if (Object.hasOwn(globals, name)) {
      throw new Error(`Both the globals setting and the page hook of ${pluginName} define ${name}.`);
    }
    const dataVariable = dataVariables.find((variable) => variable.name === name);
    if (dataVariable !== undefined) {
      throw new Error(`Both ${dataVariable.sourcePath} and the page hook of ${pluginName} define ${name}.`);
    }
    const other = hookDefiners.get(name);
    if (other !== undefined) {
      throw new Error(`Both the page hooks of ${other} and ${pluginName} define ${name}.`);
    }
    hookDefiners.set(name, pluginName);
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
    const hookDefiner = hookDefiners.get(name);
    if (hookDefiner !== undefined) {
      throw new Error(`Both the page hook of ${hookDefiner} and the plugin ${pluginName} define ${name}.`);
    }
  }
  return defined;
};
