import type { Plugin } from 'underdot';

const lookup = (variables: Record<string, unknown>, path: string): unknown => {
  let value: unknown = variables;
  for (const key of path.split('.')) {
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    value = Reflect.get(value, key);
  }
  return value;
};

// Anything but a string prints as JSON, which is the same on every machine.
const show = (value: unknown): string => (value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value));

// A plugin local to this site.
export const fixtureRenderer = (): Plugin => ({
  name: 'fixture',
  renderers: {
    tpl: (body, { variables }) => body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => show(lookup(variables, path))),
  },
});
