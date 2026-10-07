// spec: docs/specs/srcset.md

import type { Plugin } from 'underdot';
import { checkSizing } from './check-sizing.ts';
import type { Sizing } from './check-sizing.ts';
import { renderImageSet } from './render-image-set.ts';

export type { Sizing };

export interface SrcsetOptions {
  /**
   * The sizings a template names by key, each a preset:
   * `{ hero: { sizes, widths } }`.
   */
  presets?: Record<string, Sizing>;
}

export const srcset = ({ presets = {} }: SrcsetOptions = {}): Plugin => {
  // Checked as the values a JavaScript site can pass, not as the type narrows them.
  const given: unknown = presets;
  if (typeof given !== 'object' || given === null || Array.isArray(given)) {
    throw new Error('The presets option must be an object.');
  }
  for (const [name, sizing] of Object.entries(given)) {
    checkSizing(sizing, `The preset ${name}`);
  }
  return {
    name: 'srcset',
    helpers: { imageSet: (context, reference, sizing, attributes) => renderImageSet(context, presets, reference, sizing, attributes) },
  };
};
