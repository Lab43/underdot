# Sass

What the Sass plugin commits to: the file handler that compiles every SCSS stylesheet to CSS, how a stylesheet's imports resolve and become inputs of its output, how Sass's warnings reach the author, and that the plugin takes no options. The plugin is a handler under the plugin contract (see: q-docs/specs/plugins.md, File handlers), and this spec holds what it adds to that contract.

## The handler

The plugin is named `sass` and registers a file handler for `**/*.scss`. A file whose name starts with an underscore is a partial and compiles to nothing. Every other matching file compiles to CSS at its own path, with `.scss` replaced by `.css`, and Sass's output as it is with nothing appended. Rationale: a partial exists only to be imported, so it is never written, and a byte Sass did not produce is a byte the site did not ask for.

The output is Sass's expanded style, with no source map. A later handler for `**/*.css` receives the compiled file (see: q-docs/specs/plugins.md, File handlers), so a site that wants its CSS minified or prefixed adds that plugin after this one. Rationale: compressed output and source maps are needs no site has stated, and plugin order already composes them.

The handler hands Sass the file's path under the source root on disk. Rationale: relative imports resolve against the stylesheet's own directory, and Sass's reports then name the file the author edits. After an earlier handler renamed the file, the renamed path's directory is the one relative imports resolve against.

## Imports

An import resolves against the stylesheet's own directory first, and then against the source root, by Sass's own rules for partials, index files, and extensions. Rationale: a shared partial kept in `_sass/` is then `@use '_sass/mixins'` from any depth, and never written (see: q-docs/specs/source-tree.md, Underscore prefix). No package importer is enabled, and a leading slash means the filesystem root, as it does in Sass.

Every file Sass loaded for a stylesheet, other than the stylesheet itself, is declared as an input of its output (see: q-docs/specs/plugins.md, Reading and writing). A dev session then recompiles a stylesheet when any file it imports changes. A file a later save makes Sass resolve to instead takes effect only on the next change to a file the stylesheet loaded (see: q-docs/specs/build.md, Incremental builds).

An import that resolves outside the source root, or to a file the configuration excludes, fails the build naming the stylesheet and the path. Rationale: the build cannot track a file it does not see, so the stylesheet would go stale in silence. An import Sass cannot resolve fails with Sass's own report.

## Errors and warnings

A compile error passes through as Sass reports it, with the file and line (see: q-docs/specs/plugins.md, Errors).

Every `@warn`, every deprecation Sass reports, and every `@debug` is passed to the build as a warning, which prints and lets the build continue (see: q-docs/specs/plugins.md, Errors). A warning carries Sass's message with Sass's stack below it. A `@debug` carries its message with its location below it, in the stack's format. Rationale: Sass's deprecations announce what its next major release breaks, and the author learns of them from the build that would otherwise hide them.

## Options

The factory takes no options. Rationale: the `.sass` indented syntax, compressed output, source maps, and package imports are needs no site has stated.

## Determinism

The output is a function of the stylesheet, the files it loaded, and the Sass release, so every machine produces the same destination (see: q-docs/specs/build.md, Determinism).
