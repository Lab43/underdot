import { dirname, join } from 'node:path/posix';
import type { Plugin } from 'underdot';

// A plugin local to this site. `here` is the path of the file being rendered,
// `handled` is a static file's output as text, as it will be served, and
// `derived` emits a file beside a static file's output, its text lowercased
// and marked, and returns its URL. `derived` reads nothing while rendering.
export const helpers = (): Plugin => ({
  name: 'helpers',
  helpers: {
    here: (context) => context.sourcePath,
    handled: (context, reference) => context.readOutput(String(reference))?.toString().trim() ?? '',
    derived: (context, reference, extension) => {
      const outputPath = join(String(reference).startsWith('/') ? '.' : dirname(context.sourcePath), String(reference));
      const derivedPath = `${outputPath.replace(/\.[^.]*$/, '')}.derived.${String(extension)}`;
      context.emit(derivedPath, { outputPath }, ({ readOutput }) => {
        const text = readOutput(outputPath)?.toString().trim().toLowerCase() ?? '';
        return Promise.resolve(`${text} [derived]\n`);
      });
      return `/${derivedPath}`;
    },
  },
});
