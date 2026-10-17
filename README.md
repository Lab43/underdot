# Underdot

Underdot is a static site generator written in node.js that I built primarily to make marketing sites. The static site generators I had tried at the time were geared towards blogs, with a strong separation between template/layout code and content. That makes a lot of sense if your website has tons of pages that should all pretty much look the same. But when you're building a small site with many unique pages, each with different designs, that model breaks down. I wanted a system that I could throw a bunch of templates, assets, and content at and have it use some simple inheritance logic and a robust plugin system to spit out my site with minimal need for scaffolding or configuration.

Sites built with Underdot include:

- [Di Costanzo](https://www.mdcwines.com)
- [Kinsman Eades](https://www.kinsmaneades.com)
- [Impensata](https://impensata.com)
- [Abreu](https://abreuvineyards.com)
- [Almacerro](https://almacerro.com)
- [eusonic](https://www.eusonic.com)

## Getting started

[underdot-boilerplate](https://github.com/Lab43/underdot-boilerplate) is a starter site that shows a working setup with the common plugins. To start from nothing instead, follow the steps below.

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

Put the site in a directory named `source/`, with at least one template named `_.ejs` at its top:

```
source/
  _.ejs
  index.ejs
  about.ejs
  styles.css
```

Then build or develop the site:

- `npx underdot build` builds `source/` into `build/`, and exits non-zero when the build fails.
- `npx underdot dev` builds, serves the site, rebuilds on every change, and reloads the browser. It serves on port 3000, or the next free port when 3000 is busy.

Both take `--config <path>` and `--verbose`. `underdot dev` also takes `--port <n>` and `--https`.
<!-- source: q-docs/specs/configuration.md, Commands -->
<!-- source: q-docs/specs/dev-server.md, Serving -->

## Pages, templates, and static files

Underdot sorts every file in `source/` by its name:

- A file a plugin renders, such as an `.ejs` file, is a page. It is written as `index.html` in a directory named after it, so `about.ejs` becomes `about/index.html` and is served at `/about/`. A page named `index` stays where it is, and a `404` page at the top is written as `404.html`.
- A rendered file whose name starts with an underscore, such as `_.ejs`, is a template.
- Every other file is a static file. It is copied as it is, unless a plugin handles it.
- A file or directory whose name starts with an underscore is never written. Partials, data, and icons live in directories such as `_includes/`.

So the tree above builds `index.html`, `about/index.html`, and `styles.css`.
<!-- source: q-docs/specs/source-tree.md -->

## Template inheritance

The key idea in Underdot, and where it gets its name, is how a page finds its template. Every page renders through a chain of templates, and each template prints what's below it through the `_content` variable.

A page with no `template` key in its frontmatter uses the nearest template named `_`. Underdot looks in the page's own directory first, then in each parent directory up to `source/`. A template finds its own parent the same way, so templates nest.

Take this site:

```
source/
  _.ejs
  _fancy.ejs
  index.ejs
  a-very-fancy-page.ejs
  about/
    _.ejs
    team.ejs
```

- `index.ejs` renders through `_.ejs`.
- `about/team.ejs` renders through `about/_.ejs`, which renders through `_.ejs`.
- `a-very-fancy-page.ejs` sets `template: fancy` in its frontmatter. It renders through `_fancy.ejs`, which renders through `_.ejs`.

A `template` key names a template without its underscore or extension. Underdot searches for it the same way, from the page's directory upward. A section can therefore replace a site-wide template with one of the same name in its own directory: a page in `about/` asking for `fancy` would get `about/_fancy.ejs` if it existed.

A page that finds no template fails the build, and so does a `template` key that names one that doesn't exist.

[`q-docs/specs/templates.md`](https://github.com/Lab43/underdot/blob/main/q-docs/specs/templates.md) gives the full rules.
<!-- source: q-docs/specs/templates.md, Template resolution -->
<!-- source: q-docs/specs/templates.md, Rendering the chain -->

## Frontmatter and variables

A page or template can open with [YAML frontmatter](https://jekyllrb.com/docs/front-matter/). Apart from `template`, every key becomes a variable that the page and every template in its chain can read.

`source/a-very-fancy-page.ejs`:

```ejs
---
title: A Very Fancy Page
template: fancy
---

<h1><%= title %></h1>
<p>Isn't it lovely?</p>
```

`source/_fancy.ejs`:

```ejs
---
bodyClass: fancy
---

<div class="fancy-frame">
  <%- _content %>
</div>
```

`source/_.ejs`:

```ejs
<!doctype html>
<html>
<head>
  <title><%= title %></title>
</head>
<body class="<%= bodyClass %>">
  <header>The site header</header>
  <main>
    <%- _content %>
  </main>
  <footer>The site footer</footer>
</body>
</html>
```

The root template prints the page's `title` and the `bodyClass` that `_fancy.ejs` set. When two files set the same key, the one nearer the page wins, so a template sets a default and a page overrides it. In EJS, a variable no file set prints as nothing.
<!-- source: q-docs/specs/templates.md, Variables -->
<!-- source: q-docs/specs/ejs.md, Variables -->

Every file in the chain can also read these variables:

- Globals from the configuration (see [Configuration](#configuration)).
- Data files: each file in `source/_data/` defines a variable named after it, so `_data/team.json` defines `team`. A JavaScript or TypeScript module's default export works too, so data can be computed.
- `_url`: the page's URL.
- `_content`: in a template, the rendered output of the file below it.
- `_chain`: in a template, the frontmatter of each file below it, kept separate.

Frontmatter keys and globals can't start with an underscore, since those names belong to Underdot.
<!-- source: q-docs/specs/templates.md, Data files -->
<!-- source: q-docs/specs/templates.md, Built-in variables -->

## Configuration

`underdot.config.ts`, or `underdot.config.js`, default-exports the configuration. Every setting is optional:

| Setting       | What it does                                                                         | Default           |
| ------------- | ------------------------------------------------------------------------------------ | ----------------- |
| `source`      | The directory the site is read from.                                                 | `source`          |
| `destination` | The directory the site is built into.                                                | `build`           |
| `plugins`     | The plugins to use, in order.                                                        | none              |
| `globals`     | An object whose keys become variables in every page and template.                    | none              |
| `exclude`     | Glob patterns for files under `source` that the build treats as absent.              | `.DS_Store` files |
| `rewrites`    | URL globs mapped to the path the dev server serves for them. The build ignores them. | none              |

A setting Underdot doesn't know is an error. The TypeScript file runs with no compile step, so it uses only type annotations: no enums, namespaces, or parameter properties.
<!-- source: q-docs/specs/configuration.md -->

The package also exports `build` and `dev` functions that take a configuration, for a script that prepares a source tree first or builds a second output.
<!-- source: q-docs/specs/configuration.md, Programmatic use -->

## Plugins

Each plugin is its own package:

- [`underdot-ejs`](https://github.com/Lab43/underdot/tree/main/plugins/ejs#readme) renders `.ejs` pages and templates.
- [`underdot-md`](https://github.com/Lab43/underdot/tree/main/plugins/markdown#readme) renders `.md` pages, and a string of Markdown from a template.
- [`underdot-helpers`](https://github.com/Lab43/underdot/tree/main/plugins/helpers#readme) gives templates `activeLink`, `formatDate`, and `fileExists`.
- [`underdot-collections`](https://github.com/Lab43/underdot/tree/main/plugins/collections#readme) lists the pages below a directory, and reads a page's body into a template.
- [`underdot-bust`](https://github.com/Lab43/underdot/tree/main/plugins/bust#readme) adds a content hash to a link to a static file.
- [`underdot-srcset`](https://github.com/Lab43/underdot/tree/main/plugins/srcset#readme) renders an image with a `srcset`, and produces its derivatives.
- [`underdot-svgo`](https://github.com/Lab43/underdot/tree/main/plugins/svgo#readme) optimizes every SVG, and inlines one into a page.
- [`underdot-sass`](https://github.com/Lab43/underdot/tree/main/plugins/sass#readme) compiles SCSS to CSS.
- [`underdot-postcss`](https://github.com/Lab43/underdot/tree/main/plugins/postcss#readme) runs every CSS file through PostCSS plugins.
<!-- source: q-docs/specs/ -->

Plugins run in the order the configuration lists them, so `sass()` listed before `postcss()` has its compiled CSS processed by PostCSS.
<!-- source: q-docs/specs/plugins.md, Plugin identity and order -->

### Writing a plugin

A plugin is a function that returns an object of the exported `Plugin` type. Besides a `name`, the object can register any of these:

- `renderers`: a function per file extension, which turns a file into HTML.
- `helpers`: a function per name, which pages and templates call while they render.
- `handlers`: a function per glob, which every matching static file passes through, and which returns the files to write in its place.
- `pageHook`: one function that sees every page's URL and frontmatter before any page renders, and returns globals.
<!-- source: q-docs/specs/plugins.md -->

Here is a plugin that registers one helper:

```ts
import type { Plugin } from 'underdot';

export const uppercase = (): Plugin => ({
  name: 'uppercase',
  helpers: {
    uppercase: (context, text) => String(text).toUpperCase(),
  },
});
```

A helper receives the file's render context ahead of the arguments the template passes.
<!-- source: q-docs/specs/plugins.md, Template helpers -->

Add the plugin to the configuration's `plugins`, and any page or template can call it. Here it prints `team` from `_data/team.json`:

```ejs
<% team.forEach((member) => { %>
  <h2><%= uppercase(member.name) %></h2>
  <p><%= member.role %></p>
<% }); %>
```

A plugin reads files through the context it is given, and declares any file a tool it wraps reads from disk. That way the build knows what each page depends on, and rebuilds only what changed. [`q-docs/specs/plugins.md`](https://github.com/Lab43/underdot/blob/main/q-docs/specs/plugins.md) gives the full contract.
<!-- source: q-docs/specs/plugins.md, Reading and writing -->

## Upgrading from version 1

[`q-extension/guides/migrating-from-v1.md`](https://github.com/Lab43/underdot/blob/main/q-extension/guides/migrating-from-v1.md) lists every change a version 1 site makes to build on version 2.
<!-- source: underdot guides/migrating-from-v1.md -->

Version 1 is published on npm as `underdot@1`, and its source is on the `v1` branch.

## Working on Underdot

- [`q-docs/specs/`](https://github.com/Lab43/underdot/tree/main/q-docs/specs) states what Underdot commits to, and `q-docs/conventions/` holds the rules its code follows.
- [`q-docs/guides/publishing.md`](https://github.com/Lab43/underdot/blob/main/q-docs/guides/publishing.md) walks through releasing a version. Every package is released at one version, from `main`.
- The project uses [q](https://www.npmjs.com/package/@lab43/q), an agentic coding workflow for Claude Code that arrives with the project's dependencies. Start a session with `/q:implement` for a task or bug, or `/q:create-plan` for bigger work.
<!-- source: CLAUDE.md, Documentation -->
<!-- source: q-docs/guides/publishing.md -->
