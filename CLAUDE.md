## Rewrite

We are rewriting Underdot v2 from the ground up. Build v2 from the specs alone. Never read the `master` branch, the v1 package, or the source of a site built on Underdot as a reference for how anything should work, because v2 exists to shed v1's decisions and a session that reads v1 carries them over without noticing. Where the specs are silent, decide from their rationale and the conventions, or ask the user. Write test fixtures from scratch in this repo, from the specs, never from an existing site. The README's Version 2 section carries the rebuild checklist. Tick a step there when its last plan ships, and a listed plan when it ships (source: README.md, Rebuild checklist).

## Documentation

This project follows q, an agentic coding workflow. Its documentation is indexed below, a subsection per kind of doc (source: @lab43/q conventions/documentation.md, Taxonomy). Doc changes — the README and this briefing itself included — go through `/q:update-docs`.

If the session's skill list has no `/q:` skills, this machine is missing the q plugin — ask the user to install the project's dependencies (`npm install`, or the project's package manager's equivalent), then run `/q:reconcile`.

When another session is already working this repo, take a worktree rather than sharing the checkout (source: @lab43/q references/run-contract.md, The delivery branch).

Package doc paths are package name plus path from the package's `q-extension/` payload directory, resolved under `node_modules/`: `@lab43/q conventions/principles.md` is `node_modules/@lab43/q/q-extension/conventions/principles.md` (source: @lab43/q conventions/documentation.md, Package doc paths).

### Conventions

Binding decisions about how this project's code and docs get written, recorded as they are made (source: @lab43/q conventions/documentation.md, Taxonomy).

Conventions come in three tiers: q's own, the conventions of any installed extensions, and this project's own `docs/conventions/` (source: @lab43/q conventions/conventions.md, Three tiers of conventions). q and any installed extension are dependencies in `package.json`, and the payload this package ships to sites is read from its own `q-extension/` directory. Project rules win over an extension's rule, and an extension's rule wins over q's. Check all three tiers before writing code, before design decisions and reviews, and before changing docs.

`@lab43/q` — The rules of the q workflow, governing how a project's work gets planned, decided, documented, and shipped.

- `@lab43/q conventions/principles.md` — cross-cutting rules for any design decision, plan, or review
- `@lab43/q conventions/documentation.md` — what belongs in a project's documentation, where it lives, and how it stays accurate
- `@lab43/q conventions/conventions.md` — how a project's conventions are tiered, written, and enforced
- `@lab43/q conventions/extensions.md` — the extension format: rules for authoring and publishing a q extension
- `@lab43/q conventions/plans.md` — how a project's plans are written, sequenced, and carried to completion
- `@lab43/q conventions/specs.md` — how a project's specs are written and how the code is held to them
- `@lab43/q conventions/issue-tracking.md` — rules for working a project's issue tracker from any session
- `@lab43/q conventions/pull-requests.md` — rules for authoring a pull request
- `@lab43/q conventions/writing.md` — rules for writing prose: docs, plans, PR bodies, anything a human or agent will read

`underdot` — Rules for writing a site built on Underdot: its configuration, source tree, templates, and plugins.

- `underdot conventions/configuration.md` — rules for writing a site's Underdot configuration file
- `underdot conventions/ejs.md` — rules for writing a site's EJS pages, templates, and partials
- `underdot conventions/templates.md` — rules for writing a site's pages and templates in any engine

This project's own:

- `docs/conventions/principles.md` — cross-cutting rules, including deviations from q's
- `docs/conventions/documentation.md` — documentation rulings and deviations
- `docs/conventions/toolchain.md` — the language, module system, and runtime the code is written against
- `docs/conventions/structure.md` — how the source is divided into modules: what a module holds, what it is named, and where it lives
- `docs/conventions/testing.md` — rules for writing and running the tests

### Specs

What Underdot commits to, stated as behavior the code must honor (source: @lab43/q conventions/documentation.md, Taxonomy).

- `docs/specs/source-tree.md` — what Underdot makes of a site's source directory: which files are pages, templates, and static files, where each lands in the destination, and what URL a page gets
- `docs/specs/templates.md` — how a page becomes a finished document: frontmatter, how a page finds its template chain, and which variables every file in the chain sees
- `docs/specs/plugins.md` — what a plugin can do to a build and what it owes the build in return, so the build knows what depends on what
- `docs/specs/build.md` — what one build guarantees: how the destination relates to the source, the order of work, when work is skipped, what a failure does, and what a build prints
- `docs/specs/dev-server.md` — what a development session gives an author: one command that builds, serves locally, rebuilds on change, and reloads the browser
- `docs/specs/configuration.md` — how a site tells Underdot what to build and how it is routed: the configuration file, its settings, and the commands and programmatic entry points that consume it
- `docs/specs/ejs.md` — what the EJS plugin commits to: how a file renders with EJS, what a template can read, how an include finds its partial, and the one option a site configures
- `docs/specs/bust.md` — what the bust plugin commits to: the one helper it registers, how a reference to a static file resolves, the link the helper returns, and the options the plugin takes
- `docs/specs/helpers.md` — what the helpers plugin commits to: the three helpers it registers, what each takes and returns, and the errors each raises
- `docs/specs/svgo.md` — what the SVGO plugin commits to: the file handler that optimizes every SVG, the one helper that inlines an optimized SVG into a page, and the one option the plugin takes
- `docs/specs/collections.md` — what the collections plugin commits to: the page hook that defines a global per collection, the list of the pages below a directory, and the one helper that reads a page's rendered body into a template
- `docs/specs/srcset.md` — what the srcset plugin commits to: the one helper that renders an image with a `srcset`, the derivatives it has the build produce, and the one option the plugin takes
- `docs/specs/sass.md` — what the Sass plugin commits to: the file handler that compiles every SCSS stylesheet to CSS, how its imports resolve and become inputs, how Sass's warnings reach the author, and that the plugin takes no options
- `docs/specs/postcss.md` — what the PostCSS plugin commits to: the file handler that runs every CSS file through the site's PostCSS plugins, how the files they read become inputs, how their warnings reach the author, and the one option the plugin takes
- `docs/specs/markdown.md` — what the Markdown plugin commits to: how a file renders with Markdown, the one helper it registers, and that the plugin takes no options

### Guides

How to use and operate Underdot, rather than how to write its code (source: @lab43/q conventions/documentation.md, Taxonomy).

`underdot` — Rules for writing a site built on Underdot: its configuration, source tree, templates, and plugins.

- `underdot guides/migrating-from-v1.md` — what to change in a site built on Underdot v1 so it builds on v2

This project's own:

- `docs/guides/driving-manual.md` — how to bring Underdot up and exercise it by hand: the compiled command, the published packages, and the runtimes they support
