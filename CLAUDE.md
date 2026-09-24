## Rewrite

We are rewriting Underdot v2 from the ground up. Build v2 from the specs alone. Never read the `master` branch, the v1 package, or the source of a site built on Underdot as a reference for how anything should work, because v2 exists to shed v1's decisions and a session that reads v1 carries them over without noticing. Where the specs are silent, decide from their rationale and the conventions, or ask the user. Write test fixtures from scratch in this repo, from the specs, never from an existing site.

## Documentation

This project follows q, an agentic coding workflow. Its rules live in the project's own documentation. Those rules are conventions: binding decisions about how this project's code and docs get written, recorded as they are made. Two other kinds of doc sit alongside them. Specs state what Underdot commits to, as behavior the code must honor. Guides say how to use and operate Underdot, rather than how to write it (source: @lab43/q conventions/documentation.md, Taxonomy).

If the session's skill list has no `/q:` skills, this machine is missing the q plugin — ask the user to install the project's dependencies (`npm install`, or the project's package manager's equivalent), then run `/q:reconcile`.

When another session is already working this repo, take a worktree rather than sharing the checkout (source: @lab43/q references/run-contract.md, The delivery branch).

Conventions come in three tiers: q's own, the conventions of any installed extensions, and this project's own `docs/conventions/` (source: @lab43/q conventions/conventions.md, Three tiers of conventions). q and the extensions are dependencies in `package.json`. Project rules win over an extension's rule, and an extension's rule wins over q's. Check all three tiers before writing code, before design decisions and reviews, and before changing docs. Doc changes — the README and this briefing itself included — go through `/q:update-docs`.

Package doc paths are package name plus path from the package's `q-extension/` payload directory, resolved under `node_modules/`: `@lab43/q conventions/principles.md` is `node_modules/@lab43/q/q-extension/conventions/principles.md` (source: @lab43/q conventions/documentation.md, Package doc paths).

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

This project's own:

- `docs/conventions/principles.md` — cross-cutting rules, including deviations from q's
- `docs/conventions/documentation.md` — documentation rulings and deviations
- `docs/conventions/toolchain.md` — the language, module system, and runtime the code is written against

Specs — what Underdot commits to, stated as behavior the code must honor (source: @lab43/q conventions/documentation.md, Taxonomy):

- `docs/specs/source-tree.md` — what Underdot makes of a site's source directory: which files are pages, templates, and static files, where each lands in the destination, and what URL a page gets
- `docs/specs/templates.md` — how a page becomes a finished document: frontmatter, how a page finds its template chain, and which variables every file in the chain sees
- `docs/specs/plugins.md` — what a plugin can do to a build and what it owes the build in return, so the build knows what depends on what
- `docs/specs/build.md` — what one build guarantees: how the destination relates to the source, the order of work, when work is skipped, and what a failure does
- `docs/specs/dev-server.md` — what a development session gives an author: one command that builds, serves locally, rebuilds on change, and reloads the browser
- `docs/specs/configuration.md` — how a site tells Underdot what to build and how it is routed: the configuration file, its settings, and the commands and programmatic entry points that consume it

Guides — how to use and operate Underdot, rather than how to write its code (source: @lab43/q conventions/documentation.md, Taxonomy):

- `docs/guides/migrating-from-v1.md` — what to change in a site built on Underdot v1 so it builds on v2, each entry pointing at the spec section that decided it
