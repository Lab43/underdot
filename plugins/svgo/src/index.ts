// spec: q-docs/specs/svgo.md

import { optimize } from 'svgo';
import type { Config, PluginConfig } from 'svgo';
import type { Plugin } from 'underdot';
import { inlineSvg } from './inline-svg.ts';
import { optimizeSvg } from './optimize-svg.ts';

export interface SvgoOptions {
  /**
   * svgo's plugin list. It replaces the default rather than extending it. The
   * default is `preset-default` with `inlineStyles` off, then `prefixIds`.
   */
  plugins?: PluginConfig[];
}

// Styles stay a stylesheet a page's CSS can override without !important, and
// the prefix keeps one inlined SVG's styles and ids from reaching another's.
const defaultPlugins: PluginConfig[] = [
  { name: 'preset-default', params: { overrides: { inlineStyles: false } } },
  'prefixIds',
];

export const svgo = ({ plugins = defaultPlugins }: SvgoOptions = {}): Plugin => {
  if (!Array.isArray(plugins)) {
    throw new Error('The plugins option must be an array.');
  }
  // Checked as the values a JavaScript site can pass, not as the type narrows them.
  const entries: unknown[] = plugins;
  for (const entry of entries) {
    const isNamed = typeof entry === 'object' && entry !== null && 'name' in entry && typeof entry.name === 'string';
    if (typeof entry !== 'string' && !isNamed) {
      throw new Error('Each plugins entry must be a plugin name or an object with a name.');
    }
  }
  const config: Config = { multipass: true, plugins };
  // One optimization at setup, so a name svgo does not know fails the
  // configuration load rather than the first SVG.
  optimize('<svg xmlns="http://www.w3.org/2000/svg"/>', config);
  return {
    name: 'svgo',
    handlers: { '**/*.svg': (file) => optimizeSvg(file, config) },
    helpers: { inlineSvg },
  };
};
