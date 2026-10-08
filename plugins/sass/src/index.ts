// spec: docs/specs/sass.md

import type { Plugin } from 'underdot';
import { compileSass } from './compile-sass.ts';

export const sass = (): Plugin => ({
  name: 'sass',
  handlers: { '**/*.scss': compileSass },
});
