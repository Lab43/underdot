// spec: q-docs/specs/srcset.md

/**
 * How an image's set is offered: the `sizes` attribute, the widths to
 * resize it to, and whether its derivatives convert to WebP, which they do
 * unless `webp` is false. A preset is a sizing configured under a name.
 */
export interface Sizing {
  sizes: string;
  widths: number[];
  webp?: boolean;
}

/**
 * Fail a value that is not a sizing, naming it by the label given.
 */
export const checkSizing: (sizing: unknown, label: string) => asserts sizing is Sizing = (sizing, label) => {
  if (typeof sizing !== 'object' || sizing === null || Array.isArray(sizing)) {
    throw new Error(`${label} must be an object.`);
  }
  if (!('sizes' in sizing) || typeof sizing.sizes !== 'string') {
    throw new Error(`${label} needs sizes, a string.`);
  }
  const widths: unknown = 'widths' in sizing ? sizing.widths : undefined;
  if (!Array.isArray(widths) || widths.length === 0 || !widths.every((width) => Number.isInteger(width) && Number(width) > 0)) {
    throw new Error(`${label} needs widths, a non-empty list of positive integers.`);
  }
  if ('webp' in sizing && sizing.webp !== undefined && typeof sizing.webp !== 'boolean') {
    throw new Error(`${label} may only have webp true or false.`);
  }
};
