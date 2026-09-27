// spec: docs/specs/plugins.md

import { isObject } from '../shared/is-object.ts';

// What a renderer knows about the file it is rendering: its path under the
// source root, the page's during the page's render and the template's during
// a template's render.
export interface RenderContext {
  sourcePath: string;
}

export type Renderer = (body: string, context: RenderContext) => string | Promise<string>;

export interface Plugin {
  name: string;
  // Keyed by the extension without its dot: `{ md: render }`.
  renderers?: Record<string, Renderer>;
}

// The renderers the plugins registered, keyed by extension.
export interface Registry {
  renderers: Map<string, { pluginName: string; render: Renderer }>;
}

// Build the registry from the plugins in the order the configuration lists them.
export const registerPlugins = (plugins: Plugin[]): Registry => {
  const names = new Set<string>();
  const renderers = new Map<string, { pluginName: string; render: Renderer }>();
  for (const plugin of plugins) {
    if (names.has(plugin.name)) {
      throw new Error(`Two plugins are named ${plugin.name}.`);
    }
    names.add(plugin.name);
    if (plugin.renderers === undefined) {
      continue;
    }
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
  return { renderers };
};
