# Underdot

Underdot is a static site generator written in node.js that I built primarily to make marketing sites. The static site generators I had tried at the time were geared towards blogs, with a strong separation between template/layout code and content. That makes a lot of sense if your website has tons of pages that should all pretty much look the same. But when you're building a small site with many unique pages, each with different designs, that model breaks down. I wanted a system that I could throw a bunch of templates, assets, and content at and have it use some simple inheritance logic and a robust plugin system to spit out my site with minimal need for scaffolding or configuration.

## Version 2

This branch is Underdot version 2. Its documentation is in three places:
<!-- source: CLAUDE.md, Documentation -->

- `docs/specs/` states what version 2 commits to.
- `docs/conventions/` holds the rules its code follows.
- `docs/guides/` holds the guides: the changes a version 1 site makes to build on version 2, and how to drive Underdot by hand.

Version 1 is published on npm as `underdot@1`, and its source is on the `master` branch.

### Rebuild checklist

The rewrite proceeds through these steps, in this order. Each step is one or more plans created with `/q:create-plan` from the specs. A step is divided into plans when its decisions are best made one plan at a time. Each plan is then grounded in the code the one before shipped. A divided step lists its plans beneath it. A step is ticked when its last plan ships, and a listed plan when it ships.

1. [x] **Scaffolding.** The core package at the repository root with plugin packages as npm workspaces, TypeScript per the toolchain convention, the Node floor, the built-in test runner, a linter, GitHub Actions, and the q extension payload.
2. [x] **Configuration and the static build.** Three plans:
   1. [x] **Configuration.** The exported configuration type, loading the configuration file with the both-present and path-override rules, unknown-setting errors, source and destination defaults, the placement rules, and the default exclude pattern.
   2. [x] **The static build.** Walking the source, excluded files, classifying every file as static with the underscore and dotfile rules, output paths, unique output paths, a destination that does not depend on traversal order, writing and cleaning the destination, exported as a function taking a configuration.
   3. [x] **The `underdot build` command.** The bin entry, argument parsing, the configuration path option, exit status, and how a failure is printed.
3. [ ] **Pages and templates.** Plugin identity and renderer registration, page and template classification, frontmatter, template resolution, chain rendering, variables and built-ins, globals and data files, page output paths and URLs, proven with a fixture renderer.
4. [ ] **EJS and the render context.** The render context with its reads and logger, and the EJS plugin as the first real renderer.
5. [ ] **File handlers and helpers.** The cache-busting plugin as their first consumer, and a fixture producer proving emitted files.
6. [ ] **Page hooks and error attribution.** The collections plugin as their first consumer.
7. [ ] **Incremental rebuilds.** A session that reruns only the units whose inputs changed, proven equal to a full build.
8. [ ] **Dev server.** Watching, serving, live reload, build status, and the `underdot dev` command.
9. [ ] **Images plugin.** Emitted derivatives with producers.
10. [ ] **Markdown plugin.**
11. [ ] **Sass plugin.**

Each plugin's spec is written inside the plan that builds it. The `underdot` package ships a q extension for sites that use it, carrying conventions for authoring a site. Each step writes the site-facing conventions it decides into that payload as it ships.

## Working with q

This project uses [q](https://www.npmjs.com/package/@lab43/q), an agentic coding workflow that grounds Claude Code sessions in the project's own conventions. It arrives with the project's dependencies, and Claude Code loads it from the repo's tracked settings.

The project's rules live in `docs/conventions/`, and q ships rules of its own inside the package. Sessions read both before writing code, and record new decisions into the project's docs as they are made — the docs assemble themselves out of the work.

A session lists every `/q:` skill. Start with these:

- `/q:implement` — take on a task or bug
- `/q:create-plan`, then `/q:implement-plan` — plan bigger work, then execute the plan
- `/q:review` — review anything against the project's conventions
