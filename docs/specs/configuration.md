# Configuration

How a site tells Underdot what to build and how it is routed: the configuration file, the settings it holds, and the commands and programmatic entry points that consume it. The configuration describes the site. How a dev-server session is served on this machine, its port and whether it uses HTTPS, is given to the command that starts it.

## The configuration file

A project's configuration is a module named `underdot.config.ts` or `underdot.config.js` in the project directory, and its default export is the configuration. Both files present is an error. A command may be pointed at a different file. Rationale: settings such as image presets are computed, and a module is the one format in which computing them needs no second language. A TypeScript configuration is checked against the package's exported types, so a wrong plugin option fails in the editor rather than in a build.

A TypeScript configuration runs on the Node runtime's own type stripping, with no compile step and no loader. It therefore uses only syntax the runtime erases: type annotations and no enums, namespaces, or parameter properties. Rationale: a loader is a dependency and a second toolchain for a file that needs neither.

A setting the configuration does not know is an error naming the setting, before any work starts. Rationale: a misspelled setting that is silently ignored is indistinguishable from one that had no effect.

The configuration is data. It constructs nothing and runs nothing, so a dev-server session can reload it and a command can read it more than once. Rationale: the session, not the configuration, owns the build engine and its memory (see: docs/specs/dev-server.md, Session).

## Source and destination

The configuration names the source root and the destination, as paths relative to the project directory. The defaults are `source` and `build`. The destination must satisfy the build's placement rules, checked before any work starts (see: docs/specs/build.md, Destination).

## Excluded files

The configuration may list glob patterns for files under the source root that the build treats as absent: they are not classified, not handled, and not written. The default excludes `.DS_Store` files everywhere. Rationale: operating-system litter appears in every source tree and belongs in no destination, and a site with a file of its own to hide needs the same tool.

## Globals

The configuration may define globals, an object whose keys become variables in every page and template (see: docs/specs/templates.md, Variables). A global whose name starts with an underscore is an error, since that class is reserved (see: docs/specs/templates.md, Reserved keys). A global whose name a data file also defines, or a registered helper carries, is an error naming both (see: docs/specs/templates.md, Data files) (see: docs/specs/plugins.md, Template helpers).

## Plugins

The configuration lists the plugins in order (see: docs/specs/plugins.md, Plugin identity and order). A site with no renderer among its plugins builds static files only (see: docs/specs/templates.md).

## Rewrites

The configuration may list rewrites: pairs of a glob and the path to serve for any request URL the glob matches. The dev server applies them to a request before looking for a file (see: docs/specs/dev-server.md, Serving). A build ignores them. Globs are the one pattern syntax the configuration uses, for rewrites, excluded files, and file handler rules alike. Rationale: a site whose production server routes several URLs to one page, as a hosted store's routes are sent to the page that embeds it, is a site whose routing is a fact about the site, committed alongside the rules its production server carries. Without it the dev server cannot show the author those pages.

## Commands

Underdot installs one command, `underdot`, with two subcommands:

- `underdot build` builds the site and exits with a non-zero status when the build fails (see: docs/specs/build.md, Errors).
- `underdot dev` runs a dev-server session (see: docs/specs/dev-server.md). It accepts a port and an HTTPS option. Rationale: how a session is served on this machine is a fact about the session, not about the site, so it stays out of the configuration. Two sessions of one site in two worktrees share a configuration and cannot share a port, and a site that must be served over HTTPS says so in its `dev` script.

Both accept a path to a configuration file in place of the default.

## Programmatic use

The package exports the build and the dev-server session as functions taking a configuration, so a script can prepare a source tree before building or serving it, or build and serve a second output from a second configuration. What the functions do is what the commands do, and a script may run several sessions at once on different ports. Rationale: a project that assembles a source from several directories, or builds a companion page from the same templates, needs a step no setting expresses, and the command line is a thin layer over the same calls.
