# underdot-postcss

Runs every CSS file in an [Underdot](https://github.com/Lab43/underdot#readme) site through the [PostCSS](https://postcss.org) plugins the site lists.
<!-- source: docs/specs/postcss.md -->

## Install

```sh
npm install underdot-postcss autoprefixer
```

```ts
import autoprefixer from 'autoprefixer';
import type { Configuration } from 'underdot';
import { postcss } from 'underdot-postcss';
import { sass } from 'underdot-sass';

export default {
  plugins: [sass(), postcss({ plugins: [autoprefixer()] })],
} satisfies Configuration;
```

## Processing
<!-- source: docs/specs/postcss.md, The handler -->
<!-- source: docs/specs/postcss.md, Dependencies -->
<!-- source: docs/specs/postcss.md, Errors and warnings -->

- Every `.css` file, a private one included, is processed and left at its own path, with no source map.
- Plugins run in the order the configuration lists them, so `sass()` listed first has its compiled CSS processed too.
- Every file a PostCSS plugin reports reading, as `postcss-import` does, is tracked, so `underdot dev` reprocesses the stylesheet when one changes.
- A reported file outside the source root fails the build.
- A plugin reporting a directory fails the build, which rules out plugins that scan directories, such as Tailwind.
- A PostCSS plugin's warnings print, and the build continues.

No `postcss.config.js` is read. The plugins are listed in the Underdot configuration.

## Options
<!-- source: docs/specs/postcss.md, Options -->

- `plugins`: the PostCSS plugins every CSS file runs through, in order. Required, with at least one plugin.

[`docs/specs/postcss.md`](https://github.com/Lab43/underdot/blob/main/docs/specs/postcss.md) holds every rule the plugin commits to.
