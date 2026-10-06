// spec: docs/specs/plugins.md, Page hooks

import { isObject } from '../shared/is-object.ts';
import { attributePluginError } from './attribute-plugin-error.ts';
import type { RegisteredHook } from './register-plugins.ts';

/**
 * A page as a hook sees it: its source path, where it is written, its URL,
 * and its frontmatter as written, the template directive apart.
 */
export interface HookPage {
  sourcePath: string;
  outputPath: string;
  url: string;
  frontmatter: Readonly<Record<string, unknown>>;
}

/**
 * One global a page hook defined, with the plugin that defined it.
 */
export interface HookGlobal {
  name: string;
  pluginName: string;
  value: unknown;
}

/**
 * Run every hook in plugin order, each over one list of every page. The
 * globals come back in the order the hooks ran and their keys were defined.
 */
export const runPageHooks = async (pages: readonly HookPage[], hooks: RegisteredHook[]): Promise<HookGlobal[]> => {
  const hookPages = pages.map(({ sourcePath, outputPath, url, frontmatter }): HookPage => ({ sourcePath, outputPath, url, frontmatter }));
  const globals: HookGlobal[] = [];
  for (const { pluginName, hook } of hooks) {
    let defined: unknown;
    // spec: docs/specs/plugins.md, Errors
    try {
      defined = await hook(hookPages);
    } catch (error) {
      throw attributePluginError('Running the page hook', pluginName, error);
    }
    if (!isObject(defined)) {
      throw new Error(`The page hook of ${pluginName} must return an object of globals.`);
    }
    for (const [name, value] of Object.entries(defined)) {
      if (name.startsWith('_')) {
        throw new Error(`The global ${name} from the page hook of ${pluginName} starts with an underscore, which is reserved.`);
      }
      globals.push({ name, pluginName, value });
    }
  }
  return globals;
};
