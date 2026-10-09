# Underdot

Underdot is a static site generator written in node.js that I built primarily to make marketing sites. The static site generators I had tried at the time were geared towards blogs, with a strong separation between template/layout code and content. That makes a lot of sense if your website has tons of pages that should all pretty much look the same. But when you're building a small site with many unique pages, each with different designs, that model breaks down. I wanted a system that I could throw a bunch of templates, assets, and content at and have it use some simple inheritance logic and a robust plugin system to spit out my site with minimal need for scaffolding or configuration.

## Getting started

Underdot runs on Node 22.18 or a later 22 release, or on Node 23.5 or later.
<!-- source: package.json -->

Install Underdot and a renderer for your pages:

```sh
npm install underdot underdot-ejs
```

Write `underdot.config.ts` in the project directory:

```ts
import type { Configuration } from 'underdot';
import { ejs } from 'underdot-ejs';

export default {
  plugins: [ejs()],
} satisfies Configuration;
```

Write the site under `source/`. Every page renders inside the nearest template named `_`, which prints the page through `_content`:

```
source/
  _.ejs          <html><body><%- _content %></body></html>
  index.ejs      <h1>Home</h1>
  about.ejs      <h1>About</h1>
  styles.css
```

Then build or develop the site:

- `npx underdot build` builds `source/` into `build/`, and exits non-zero when the build fails.
- `npx underdot dev` builds, serves the site, rebuilds on every change, and reloads the browser. It serves on port 3000, or the next free port when 3000 is busy.

Both take `--config <path>` and `--verbose`. `underdot dev` also takes `--port <n>` and `--https`.
<!-- source: docs/specs/configuration.md, Commands -->
<!-- source: docs/specs/dev-server.md, Serving -->

This tree builds `index.html`, `about/index.html`, and `styles.css`:

- A file a plugin renders is a page, written as `index.html` in a directory named after it, so `about.ejs` is served at `/about/`.
- A rendered file whose name starts with an underscore is a template, and a page picks a template other than `_` with a `template` key in its frontmatter.
- Every other file is copied as it is.
- A file or directory whose name starts with an underscore is never written, so partials, data, and icons live in directories such as `_includes/`.

[`docs/specs/source-tree.md`](https://github.com/Lab43/underdot/blob/main/docs/specs/source-tree.md) and [`docs/specs/templates.md`](https://github.com/Lab43/underdot/blob/main/docs/specs/templates.md) give the full rules.
<!-- source: docs/specs/source-tree.md -->
<!-- source: docs/specs/templates.md, Template resolution -->

## Plugins

Each plugin is its own package:

- [`underdot-ejs`](https://github.com/Lab43/underdot/tree/main/plugins/ejs#readme) renders `.ejs` pages and templates.
- [`underdot-md`](https://github.com/Lab43/underdot/tree/main/plugins/markdown#readme) renders `.md` pages, and a string of Markdown from a template.
- [`underdot-helpers`](https://github.com/Lab43/underdot/tree/main/plugins/helpers#readme) gives templates `activeLink`, `formatDate`, and `fileExists`.
- [`underdot-collections`](https://github.com/Lab43/underdot/tree/main/plugins/collections#readme) lists the pages below a directory, and reads a page's body into a template.
- [`underdot-bust`](https://github.com/Lab43/underdot/tree/main/plugins/bust#readme) adds a content hash to a link to a static file.
- [`underdot-srcset`](https://github.com/Lab43/underdot/tree/main/plugins/srcset#readme) renders an image with a `srcset`, and produces its resized copies.
- [`underdot-svgo`](https://github.com/Lab43/underdot/tree/main/plugins/svgo#readme) optimizes every SVG, and inlines one into a page.
- [`underdot-sass`](https://github.com/Lab43/underdot/tree/main/plugins/sass#readme) compiles SCSS to CSS.
- [`underdot-postcss`](https://github.com/Lab43/underdot/tree/main/plugins/postcss#readme) runs every CSS file through PostCSS plugins.
<!-- source: docs/specs/ -->

Plugins run in the order the configuration lists them, so `sass()` listed before `postcss()` has its compiled CSS processed by PostCSS. A plugin of your own is a function returning an object of the exported `Plugin` type, as [`docs/specs/plugins.md`](https://github.com/Lab43/underdot/blob/main/docs/specs/plugins.md) describes.
<!-- source: docs/specs/plugins.md, Plugin identity and order -->

## Upgrading from version 1

[`q-extension/guides/migrating-from-v1.md`](https://github.com/Lab43/underdot/blob/main/q-extension/guides/migrating-from-v1.md) lists every change a version 1 site makes to build on version 2. Version 1 is published on npm as `underdot@1`, and its source is on the `v1` branch.
<!-- source: underdot guides/migrating-from-v1.md -->

## Documentation

The documentation is in four places:
<!-- source: CLAUDE.md, Documentation -->

- `docs/specs/` states what Underdot commits to.
- `docs/conventions/` holds the rules its code follows.
- `docs/guides/` holds how to drive Underdot by hand and how to publish it.
- `q-extension/` holds what ships to sites that use Underdot: the rules for writing a site, and the changes a version 1 site makes to build on version 2.

## Publishing

Every package is released at one version, from `main`. [`docs/guides/publishing.md`](https://github.com/Lab43/underdot/blob/main/docs/guides/publishing.md) walks through the version bump, the checks, the publish, confirming it landed, and the tag.
<!-- source: docs/guides/publishing.md -->

## Working with q

This project uses [q](https://www.npmjs.com/package/@lab43/q), an agentic coding workflow that grounds Claude Code sessions in the project's own conventions. It arrives with the project's dependencies, and Claude Code loads it from the repo's tracked settings.

The project's rules live in `docs/conventions/`, and q ships rules of its own inside the package. Sessions read both before writing code, and record new decisions into the project's docs as they are made — the docs assemble themselves out of the work.

A session lists every `/q:` skill. Start with these:

- `/q:implement` — take on a task or bug
- `/q:create-plan`, then `/q:implement-plan` — plan bigger work, then execute the plan
- `/q:review` — review anything against the project's conventions
