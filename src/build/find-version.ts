// spec: q-docs/specs/build.md, Incremental builds

import type { Versions } from './bind-build.ts';
import type { InputKind, Version } from './reuse-unit.ts';

/**
 * The current version of one input of a render. No render observes the
 * pages or the parameters, which the hook phase and the produce phase each
 * version on their own.
 */
export const findVersion = (versions: Versions, kind: InputKind, name: string): Version => {
  switch (kind) {
    case 'file':
      return versions.files.get(name)?.hash;
    case 'output':
      return versions.outputs.get(name);
    case 'body':
      return versions.bodies.get(name);
    case 'global':
      return versions.globals.get(name);
    case 'globals':
      return versions.allGlobals;
    case 'chain':
      return versions.chains.get(name);
    case 'pages':
    case 'parameters':
      return undefined;
  }
};
