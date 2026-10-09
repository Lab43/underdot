# underdot-svgo

Optimizes every SVG in an [Underdot](https://github.com/Lab43/underdot#readme) site with [svgo](https://svgo.dev), and gives templates a helper that inlines an optimized SVG into a page.
<!-- source: q-docs/specs/svgo.md -->

## Install

```sh
npm install underdot-svgo
```

```ts
import type { Configuration } from 'underdot';
import { ejs } from 'underdot-ejs';
import { svgo } from 'underdot-svgo';

export default {
  plugins: [ejs(), svgo()],
} satisfies Configuration;
```

## Optimizing
<!-- source: q-docs/specs/svgo.md, The handler -->

Every `.svg` file under the source root, a private one included, is optimized and left at its own path, so every link to it keeps working.

## The helper
<!-- source: q-docs/specs/svgo.md, The helper -->

`inlineSvg(reference)` returns the optimized SVG at the reference as text. A relative reference resolves against the file being rendered, and one starting with a slash from the source root. Keep inlined icons under an underscore directory, so the files themselves are never written:

```ejs
<%- inlineSvg('/_icons/logo.svg') %>
```

A reference no file is at is an error.

## Options
<!-- source: q-docs/specs/svgo.md, Options -->

- `plugins`: svgo's plugin list, which replaces the default rather than extending it. The default keeps inline `<style>` as a stylesheet and prefixes every id and class with the file's name:

  ```ts
  [{ name: 'preset-default', params: { overrides: { inlineStyles: false } } }, 'prefixIds']
  ```

[`q-docs/specs/svgo.md`](https://github.com/Lab43/underdot/blob/main/q-docs/specs/svgo.md) holds every rule the plugin commits to.
