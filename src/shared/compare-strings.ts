/**
 * Compare by character code rather than by locale, so every machine sorts
 * alike.
 */
export const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
