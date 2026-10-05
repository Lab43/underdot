import type { Plugin, RenderContext } from 'underdot';

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

const isHelper = (value: unknown): value is (...args: string[]) => unknown => typeof value === 'function';

// Anything but a string prints as JSON, which is the same on every machine.
const show = (value: unknown): string => (value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value));

// `{{ path }}` is a variable, `{{ name args }}` a helper called with the
// arguments as strings, `{{> path }}` a file, and `{{@ url }}` a page's body.
const evaluate = (context: RenderContext, sigil: string, argument: string): unknown => {
  switch (sigil) {
    case '>':
      return context.readFile(argument);
    case '@':
      return context.readBody(argument);
    default: {
      const [path = '', ...args] = argument.split(/\s+/);
      const value = lookup(context.variables, path);
      return isHelper(value) ? value(...args) : value;
    }
  }
};

// A plugin local to this site.
export const fixtureRenderer = (): Plugin => ({
  name: 'fixture',
  renderers: {
    tpl: (body, context) =>
      body.replace(/\{\{\s*([>@]?)\s*(.+?)\s*\}\}/g, (_match, sigil: string, argument: string) => show(evaluate(context, sigil, argument))),
  },
});
