import type { Plugin } from 'underdot';

// A plugin local to this site. Its renderer returns the body unchanged.
export const fixtureRenderer = (): Plugin => ({
  name: 'fixture',
  renderers: { tpl: (body) => body },
});
