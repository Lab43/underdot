import type { Plugin } from 'underdot';

// A plugin local to this site. `here` is the path of the file being rendered,
// and `handled` is a static file's output as text, as it will be served.
export const helpers = (): Plugin => ({
  name: 'helpers',
  helpers: {
    here: (context) => context.sourcePath,
    handled: (context, reference) => context.readOutput(String(reference))?.toString().trim() ?? '',
  },
});
