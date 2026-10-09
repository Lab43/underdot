# underdot-ejs

Renders `.ejs` pages and templates for [Underdot](https://github.com/Lab43/underdot#readme) with [EJS](https://ejs.co).
<!-- source: docs/specs/ejs.md -->

## Install

```sh
npm install underdot-ejs
```

```ts
import type { Configuration } from 'underdot';
import { ejs } from 'underdot-ejs';

export default {
  plugins: [ejs({ views: ['_includes'] })],
} satisfies Configuration;
```

## Rendering
<!-- source: docs/specs/ejs.md, Rendering -->
<!-- source: docs/specs/ejs.md, Variables -->

- `<%= %>` prints a value escaped, `<%- %>` prints it as it is, and `<% %>` runs a scriptlet.
- Every variable is reachable by its name, as `title`, and through `locals`, as `locals.title`. A name no file set reads as `undefined`.
- Rendering is synchronous, so a template cannot `await`.
- The legacy `<% include name %>` directive is a syntax error. Call `include()` instead.

## Includes
<!-- source: docs/specs/ejs.md, Includes -->

`include(reference, data)` renders a partial with the including file's variables, and the keys of `data` merged over them. A reference with no extension gets `.ejs`.

- A reference starting with a slash names a path under the source root, as `include('/_includes/header')`.
- Any other reference is tried under the including file's directory, then under each `views` directory in order.

## Options
<!-- source: docs/specs/ejs.md, Options -->

- `views`: directories under the source root, written without a leading slash, searched for an include after the including file's own directory. Defaults to none.

[`docs/specs/ejs.md`](https://github.com/Lab43/underdot/blob/main/docs/specs/ejs.md) holds every rule the plugin commits to.
