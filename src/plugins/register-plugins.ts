// spec: docs/specs/plugins.md

import { isObject } from '../shared/is-object.ts';
import type { RenderContext } from './bind-render-context.ts';

export type Renderer = (body: string, context: RenderContext) => string | Promise<string>;

export interface Plugin {
  name: string;
  // Keyed by the extension without its dot: `{ md: render }`.
  renderers?: Record<string, Renderer>;
}

export interface RegisteredRenderer {
  pluginName: string;
  render: Renderer;
}

// The renderers the plugins registered, keyed by extension.
export interface Registry {
  renderers: Map<string, RegisteredRenderer>;
}

// Build the registry from the plugins in the order the configuration lists them.
export const registerPlugins = (plugins: Plugin[]): Registry => {
  const names = new Set<string>();
  const renderers = new Map<string, RegisteredRenderer>();
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
