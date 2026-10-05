// spec: docs/specs/plugins.md

import { isObject } from '../shared/is-object.ts';
import type { RenderContext } from './bind-render-context.ts';
import type { HandledFile, HandlerOutput } from './run-handlers.ts';

export type Renderer = (body: string, context: RenderContext) => string | Promise<string>;

/**
 * A function every static file whose path matches the handler's glob passes
 * through. It returns the files to write in the file's place: the file as it
 * is, the file transformed or renamed, several files, or none.
 */
export type FileHandler = (file: HandledFile) => HandlerOutput[] | Promise<HandlerOutput[]>;

/**
 * A function a page or template calls by name. It receives the render context
 * ahead of the arguments written in the template, which a helper narrows
 * itself, and returns synchronously.
 */
export type Helper = (context: RenderContext, ...args: unknown[]) => unknown;

export interface Plugin {
  name: string;
  /**
   * Keyed by the extension without its dot: `{ md: render }`.
   */
  renderers?: Record<string, Renderer>;
  /**
   * Keyed by the name a template calls: `{ bust: helper }`.
   */
  helpers?: Record<string, Helper>;
  /**
   * Keyed by the glob the handler matches, in minimatch's dialect:
   * `{ 'styles/*.scss': compile }`.
   */
  handlers?: Record<string, FileHandler>;
}

export interface RegisteredRenderer {
  pluginName: string;
  render: Renderer;
}

export interface RegisteredHelper {
  pluginName: string;
  helper: Helper;
}

export interface RegisteredHandler {
  pluginName: string;
  glob: string;
  handle: FileHandler;
}

/**
 * What the plugins registered: renderers keyed by extension, helpers by name,
 * and handlers in the order they run.
 */
export interface Registry {
  renderers: Map<string, RegisteredRenderer>;
  helpers: Map<string, RegisteredHelper>;
  handlers: RegisteredHandler[];
}

/**
 * Build the registry from the plugins in the order the configuration lists them.
 */
export const registerPlugins = (plugins: Plugin[]): Registry => {
  const names = new Set<string>();
  const renderers = new Map<string, RegisteredRenderer>();
  const helpers = new Map<string, RegisteredHelper>();
  const handlers: RegisteredHandler[] = [];
  for (const plugin of plugins) {
    if (names.has(plugin.name)) {
      throw new Error(`Two plugins are named ${plugin.name}.`);
    }
    names.add(plugin.name);
    if (plugin.renderers !== undefined) {
      if (!isObject(plugin.renderers)) {
        throw new Error(`The renderers of ${plugin.name} must be an object.`);
      }
      for (const [extension, render] of Object.entries(plugin.renderers)) {
        if (typeof render !== 'function') {
          throw new Error(`The renderer ${plugin.name} registers for ${extension} is not a function.`);
        }
        const other = renderers.get(extension);
        if (other !== undefined) {
          throw new Error(`Both ${other.pluginName} and ${plugin.name} register a renderer for ${extension}.`);
        }
        renderers.set(extension, { pluginName: plugin.name, render });
      }
    }
    if (plugin.helpers !== undefined) {
      if (!isObject(plugin.helpers)) {
        throw new Error(`The helpers of ${plugin.name} must be an object.`);
      }
      for (const [name, helper] of Object.entries(plugin.helpers)) {
        if (typeof helper !== 'function') {
          throw new Error(`The helper ${name} of ${plugin.name} is not a function.`);
        }
        if (name.startsWith('_')) {
          throw new Error(`The helper ${name} of ${plugin.name} starts with an underscore, which is reserved.`);
        }
        const other = helpers.get(name);
        if (other !== undefined) {
          throw new Error(`Both ${other.pluginName} and ${plugin.name} register a helper named ${name}.`);
        }
        helpers.set(name, { pluginName: plugin.name, helper });
      }
    }
    if (plugin.handlers !== undefined) {
      if (!isObject(plugin.handlers)) {
        throw new Error(`The handlers of ${plugin.name} must be an object.`);
      }
      for (const [glob, handle] of Object.entries(plugin.handlers)) {
        if (typeof handle !== 'function') {
          throw new Error(`The handler ${plugin.name} registers for ${glob} is not a function.`);
        }
        handlers.push({ pluginName: plugin.name, glob, handle });
      }
    }
  }
  return { renderers, helpers, handlers };
};
