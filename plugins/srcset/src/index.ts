// spec: docs/specs/srcset.md

import type { Plugin } from 'underdot';
import { checkPreset } from './check-preset.ts';
import type { Preset } from './check-preset.ts';
import { renderImageSet } from './render-image-set.ts';

export type { Preset };

export interface SrcsetOptions {
  /**
   * The presets a template names by key: `{ hero: { sizes, widths } }`.
   */
  presets?: Record<string, Preset>;
}

export const srcset = ({ presets = {} }: SrcsetOptions = {}): Plugin => {
  // Checked as the values a JavaScript site can pass, not as the type narrows them.
  const given: unknown = presets;
  if (typeof given !== 'object' || given === null || Array.isArray(given)) {
    throw new Error('The presets option must be an object.');
  }
  for (const [name, preset] of Object.entries(given)) {
    checkPreset(preset, `The preset ${name}`);
  }
  return {
    name: 'srcset',
    helpers: { imageSet: (context, reference, preset, attributes) => renderImageSet(context, presets, reference, preset, attributes) },
  };
};
