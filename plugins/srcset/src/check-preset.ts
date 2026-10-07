// spec: docs/specs/srcset.md

/**
 * How an image's set is offered: the `sizes` attribute, the widths to
 * resize it to, and whether its derivatives convert to WebP, which they do
 * unless `webp` is false.
 */
export interface Preset {
  sizes: string;
  widths: number[];
  webp?: boolean;
}

/**
 * Fail a value that is not a preset, naming it by the label given.
 */
export const checkPreset: (preset: unknown, label: string) => asserts preset is Preset = (preset, label) => {
  if (typeof preset !== 'object' || preset === null || Array.isArray(preset)) {
    throw new Error(`${label} must be an object.`);
  }
  if (!('sizes' in preset) || typeof preset.sizes !== 'string') {
    throw new Error(`${label} needs sizes, a string.`);
  }
  const widths: unknown = 'widths' in preset ? preset.widths : undefined;
  if (!Array.isArray(widths) || widths.length === 0 || !widths.every((width) => Number.isInteger(width) && Number(width) > 0)) {
    throw new Error(`${label} needs widths, a non-empty list of positive integers.`);
  }
  if ('webp' in preset && preset.webp !== undefined && typeof preset.webp !== 'boolean') {
    throw new Error(`${label} may only have webp true or false.`);
  }
};
