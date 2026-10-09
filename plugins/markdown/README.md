# underdot-md

Renders `.md` pages for [Underdot](https://github.com/Lab43/underdot#readme), and gives templates a helper that renders a string of Markdown.
<!-- source: q-docs/specs/markdown.md -->

## Install

```sh
npm install underdot-md
```

```ts
import type { Configuration } from 'underdot';
import { markdown } from 'underdot-md';

export default {
  plugins: [markdown()],
} satisfies Configuration;
```

## Rendering
<!-- source: q-docs/specs/markdown.md, Rendering -->

A page's body renders as GitHub Flavored Markdown, as [marked](https://marked.js.org) renders it with its defaults:

- Tables, strikethrough, and bare-URL autolinks render.
- Raw HTML passes through as written.
- Link and image targets are written as given.

A body reads no variable, so a page that needs one is written in another engine. A Markdown page renders inside a template written in another engine, such as EJS. A Markdown file whose name starts with an underscore is a template, and rendering one is an error.

## The helper
<!-- source: q-docs/specs/markdown.md, The helper -->

`markdown(text)` returns the text rendered as HTML, as a page's body renders. A `text` that is not a string is an error, so a template checks for a missing variable before calling it.

```ejs
<%- markdown(summary) %>
```

## Options
<!-- source: q-docs/specs/markdown.md, Options -->

The plugin takes no options.

[`q-docs/specs/markdown.md`](https://github.com/Lab43/underdot/blob/main/q-docs/specs/markdown.md) holds every rule the plugin commits to.
