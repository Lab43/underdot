# underdot-bust

Gives [Underdot](https://github.com/Lab43/underdot#readme) templates a helper that links to a static file with a hash of its contents, so a browser reloads the file when it changes and keeps it cached otherwise.
<!-- source: q-docs/specs/bust.md -->

## Install

```sh
npm install underdot-bust
```

```ts
import type { Configuration } from 'underdot';
import { bust } from 'underdot-bust';
import { ejs } from 'underdot-ejs';

export default {
  plugins: [ejs(), bust()],
} satisfies Configuration;
```

## The helper
<!-- source: q-docs/specs/bust.md, The helper -->
<!-- source: q-docs/specs/bust.md, References -->

`bust(reference)` returns the file's absolute URL followed by `?v=` and eight hexadecimal characters of the SHA-256 of the bytes the build writes:

```ejs
<link rel="stylesheet" href="<%= bust('/styles.css') %>">
```

```html
<link rel="stylesheet" href="/styles.css?v=1a2b3c4d">
```

- A relative reference resolves against the file being rendered, and one starting with a slash from the source root.
- The hash is of the handled output, so a stylesheet compiled by Sass changes its link when the compiled CSS changes.
- A reference under an underscore is an error, since that file is never written.
- A reference no static file's output is at is an error.

## Options
<!-- source: q-docs/specs/bust.md, Options -->

The plugin takes no options.

[`q-docs/specs/bust.md`](https://github.com/Lab43/underdot/blob/main/q-docs/specs/bust.md) holds every rule the plugin commits to.
