# underdot-sass

Compiles every SCSS stylesheet in an [Underdot](https://github.com/Lab43/underdot#readme) site to CSS with [Sass](https://sass-lang.com).
<!-- source: docs/specs/sass.md -->

## Install

```sh
npm install underdot-sass
```

```ts
import type { Configuration } from 'underdot';
import { sass } from 'underdot-sass';

export default {
  plugins: [sass()],
} satisfies Configuration;
```

## Compiling
<!-- source: docs/specs/sass.md, The handler -->
<!-- source: docs/specs/sass.md, Imports -->
<!-- source: docs/specs/sass.md, Errors and warnings -->

- Every `.scss` file compiles to a `.css` file at the same path, in Sass's expanded style with no source map.
- A file whose name starts with an underscore is a partial, and compiles to nothing.
- An import resolves against the stylesheet's own directory, then against the source root, so a partial kept in `_sass/` is `@use '_sass/mixins'` from any depth.
- An import outside the source root fails the build.
- Every file a stylesheet imports is tracked, so `underdot dev` recompiles the stylesheet when one changes.
- `@warn`, `@debug`, and Sass's deprecations print, and the build continues.

To minify or prefix the compiled CSS, list [`underdot-postcss`](https://github.com/Lab43/underdot/tree/main/plugins/postcss#readme) after this plugin.

## Options
<!-- source: docs/specs/sass.md, Options -->

The plugin takes no options.

[`docs/specs/sass.md`](https://github.com/Lab43/underdot/blob/main/docs/specs/sass.md) holds every rule the plugin commits to.
