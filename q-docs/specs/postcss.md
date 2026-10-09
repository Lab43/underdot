# PostCSS

What the PostCSS plugin commits to: the file handler that runs every CSS file through the PostCSS plugins a site lists, how the files those plugins read become inputs, how PostCSS's warnings reach the author, and the one option the plugin takes. The plugin is a handler under the plugin contract (see: q-docs/specs/plugins.md, File handlers), and this spec holds what it adds to that contract.

## The handler

The plugin is named `postcss` and registers a file handler for `**/*.css`. Every static file at such a path, a private one included, runs through the site's PostCSS plugins and is left at its own path, with PostCSS's output as it is. Rationale: a private CSS file's handled output is still read through the render context (see: q-docs/specs/plugins.md, Render context), so it should be the processed CSS. Unlike Sass, the handler has no partial rule. A private CSS file processes on its own like any other, and its output is never written (see: q-docs/specs/source-tree.md, Underscore prefix).

Handlers run in plugin order, so a site that lists `sass()` ahead of this plugin has its compiled stylesheets processed too (see: q-docs/specs/plugins.md, File handlers).

The handler hands PostCSS the file's path under the source root on disk, as both the file it reads from and the file it writes to, and asks for no source map. Rationale: a relative import resolves against the stylesheet's own directory, Browserslist's search for its configuration starts there, and PostCSS's reports name the file the author edits. After an earlier handler renamed the file, the renamed path is the one handed over. No source map annotation is appended, matching Sass's output (see: q-docs/specs/sass.md, The handler).

## Dependencies

Every file a PostCSS plugin reports reading, as a `dependency` message, is declared as an input of the output (see: q-docs/specs/plugins.md, Reading and writing). A dev session then reprocesses a stylesheet when any file it imports changes. A plugin may report a file by the path with every symlink resolved, so the report and the source root are compared that way. A file a later save makes a plugin resolve to instead takes effect only on the next change to a file the stylesheet declared (see: q-docs/specs/build.md, Incremental builds).

A reported file outside the source root, or one the configuration excludes, fails the build naming the stylesheet and the path. Rationale: the build cannot track a file it does not see, so the stylesheet would go stale in silence.

A plugin's report of a dependency on a directory fails the build naming the directory. Rationale: the build has no way to declare a directory or a glob, so a stylesheet that depended on one would go stale. This rules out plugins that scan directories, Tailwind among them.

## Errors and warnings

An error a PostCSS plugin raises passes through as PostCSS reports it, a syntax error's file, line, and column included (see: q-docs/specs/plugins.md, Errors).

Every warning a PostCSS plugin gives is passed to the build as PostCSS writes it, naming the plugin, the file, the line, and the column, and the build prints it and continues (see: q-docs/specs/plugins.md, Errors).

## Options

The factory takes one option, `plugins`, the PostCSS plugins every CSS file runs through, in order. It is typed as PostCSS's own plugin type. Rationale: prefixing, minifying, and inlining imports are each a PostCSS plugin, and the site picks which it runs. No `postcss.config.js` is read, because a second configuration file is one the dev server does not watch and the configuration's type does not check.

These are errors, raised when the configuration loads and before any file is handled:

- A missing options object, a `plugins` value that is not an array, or an empty array. Rationale: an empty list makes the plugin a silent no-op.
- An entry that is not a PostCSS plugin, with PostCSS's own message.

## Determinism

The output is a function of the stylesheet, the files it declared, the plugin list, and the installed plugin releases with the configuration they read from outside the source root, such as Browserslist's (see: q-docs/specs/build.md, Incremental builds). Every machine with the same installs then produces the same destination (see: q-docs/specs/build.md, Determinism).
