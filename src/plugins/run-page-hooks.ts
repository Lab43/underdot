// spec: docs/specs/plugins.md, Page hooks

import { hash } from 'node:crypto';
import { serialize } from 'node:v8';
import type { Reporter } from '../build/bind-reporter.ts';
import { reuseUnit } from '../build/reuse-unit.ts';
import type { Observe, UnitRecords } from '../build/reuse-unit.ts';
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
 * What a page hook receives beside the pages.
 */
export interface HookContext {
  /**
   * Print a warning naming the hook's plugin. The build goes on.
   */
  warn: (message: string) => void;
}

/**
 * One global a page hook defined, with the plugin that defined it and the
 * version of the pages it was defined from.
 */
export interface HookGlobal {
  name: string;
  pluginName: string;
  value: unknown;
  version: string;
}

/**
 * Run every hook in plugin order, each over one list of every page. The
 * globals come back in the order the hooks ran and their keys were defined. A
 * hook's run is reused while the list it sees is the same.
 */
// spec: docs/specs/build.md, Incremental builds
export const runPageHooks = async (
  pages: readonly HookPage[],
  hooks: RegisteredHook[],
  records: UnitRecords<HookGlobal[]>,
  reporter: Reporter,
): Promise<HookGlobal[]> => {
  const hookPages = pages.map(({ sourcePath, outputPath, url, frontmatter }): HookPage => ({ sourcePath, outputPath, url, frontmatter }));
  // The list is the whole of a hook's inputs.
  const pagesVersion = hash('sha256', serialize(hookPages), 'hex');
  const globals: HookGlobal[] = [];
  for (const { pluginName, hook } of hooks) {
    const run = async (observe: Observe): Promise<HookGlobal[]> => {
      observe('pages', '');
      let defined: unknown;
      const warn = (message: string): void => {
        reporter.warned('Running the page hook', pluginName, message);
      };
      // spec: docs/specs/plugins.md, Errors
      try {
        defined = await hook(hookPages, { warn });
      } catch (error) {
        throw attributePluginError('Running the page hook', pluginName, error);
      }
      if (!isObject(defined)) {
        throw new Error(`The page hook of ${pluginName} must return an object of globals.`);
      }
      return Object.entries(defined).map(([name, value]) => {
        if (name.startsWith('_')) {
          throw new Error(`The global ${name} from the page hook of ${pluginName} starts with an underscore, which is reserved.`);
        }
        return { name, pluginName, value, version: pagesVersion };
      });
    };
    globals.push(...await reuseUnit(records, pluginName, () => pagesVersion, run));
  }
  return globals;
};
