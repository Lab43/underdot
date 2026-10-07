/**
 * Whether the value is a path under the destination with no leading slash and
 * no empty, `.`, or `..` segment, so it neither escapes the destination nor
 * spells one location two ways.
 */
export const isPlainPath = (path: unknown): path is string =>
  typeof path === 'string' && !path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
