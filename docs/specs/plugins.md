# Plugins

What a plugin can do to a build and what it owes the build in return. Underdot itself classifies files, resolves template chains, and writes the destination. Everything that turns one kind of content into another is a plugin: template engines, asset compilers, image derivatives, collections. The contract here is what lets the build know what depends on what, which is what makes a rebuild smaller than the whole site (see: docs/specs/build.md, Incremental builds).

## Plugin identity and order

Every plugin has a name. Errors, log lines, and dependency records name the plugin they came from. Two plugins with one name in a site's configuration is a build error. Rationale: a site combines several plugins, and a failure that cannot say which one produced it sends the author reading every plugin.

The configuration lists plugins in order (see: docs/specs/configuration.md, Plugins). Order decides the sequence file handlers run in and the sequence page hooks run in. Nothing else about a plugin depends on its position.

## Renderers

A plugin registers a renderer for a file extension. The renderer turns a body and the variables into a string, and may do so asynchronously. Two plugins registering one extension is a build error naming both. Rationale: which renderer a page gets must never depend on plugin order.

A renderer lets a template read a variable no file set without raising an error. What the read yields is the renderer's choice, and it documents that choice. Rationale: a template reads attributes a page may omit, and the alternative is every read guarded by hand.

A renderer receives the render context (see: Render context) and resolves any include or relative reference through it, so the resolution rules bind every engine alike (see: docs/specs/templates.md, Relative paths).

## Template helpers

A plugin registers a helper by name. A helper is a function a page or template calls while rendering, and it receives the render context ahead of the arguments written in the template. Helpers return their value synchronously. Work that must be asynchronous, such as producing a derived file, is handed to the build (see: Emitted files) and the helper returns what the template needs now, such as the derived file's URL. Rationale: template engines call helpers synchronously by default, and a helper that must be awaited pushes async mode into every template.

Two plugins registering one helper name is a build error naming both. A helper name that starts with an underscore is a build error, since that class is reserved (see: docs/specs/templates.md, Reserved keys). A frontmatter key or global that shares a name with a registered helper is a build error naming the file, because a variable and a function under one name cannot both be reachable.

## Render context

Renderers and helpers receive a render context for the file being rendered. It carries:

- The page: its URL and output path.
- The file being rendered: its path under the source root, and so its directory. This is the page during the page's render and the template during a template's render, which is what makes relative paths resolve per file.
- The variables the file renders with, as merged (see: docs/specs/templates.md, Variables), and the `_chain` view.
- The build's read operations: read a file under the source root, read the handled output of a static file (see: File handlers), and read the rendered body of another page. Rationale: a cache-busting helper needs the hash of the CSS as it will be served, not as it sits in source, and an archive page needs each post's body as rendered.
- The build's emit operation (see: Emitted files).
- A logger.

Every read through the context is recorded as an input of the render (see: Dependencies).

Reading another page's rendered body is available while a template renders, never while a page's body renders. A page body that reads another page's body is a build error naming both pages. Rationale: every page body renders before any template does, so a template reads a body that exists, while bodies render in no defined order and one reading another would need cycle detection for a composition that belongs in a template anyway.

## File handlers

A plugin registers a file handler with a glob. Every static file whose path matches passes through the handler, underscore-prefixed files included (see: docs/specs/source-tree.md, Underscore prefix). The handler receives the file's path and contents and returns zero or more files, each a path and contents, so it may transform, rename, split into several outputs, or drop a file. Rationale: a stylesheet compiles to one CSS file and one source map, and a partial compiles to nothing.

Handlers run in plugin order. What one handler returns is what the next matching handler receives, and what the last returns is what the build writes, subject to the underscore and uniqueness rules of the source tree. Rationale: a compile-then-prefix-then-hash pipeline is the ordinary case, and order is the site's one tool to arrange it.

All file handling for a build completes before any page renders. Rationale: helpers read handled output synchronously (see: Template helpers), so it must exist by then.

## Emitted files

A plugin emits a file into the destination by naming its output path and supplying a producer that yields the contents. Emitting is available while the plugin is set up and from helpers during a render. An emitted file passes through the file handlers of the plugins after the emitting plugin, and then falls under the source tree's output rules like any other file.

Two emits of one path with the same inputs in one build are one output. Rationale: an image helper called from several pages asks for the same derivative each time. Two emits of one path with different inputs are a uniqueness error naming both (see: docs/specs/source-tree.md, Output paths are unique).

The producer runs only when the emitted file's inputs have changed since it last ran (see: Dependencies). Rationale: resizing every image on every rebuild is the largest cost a dev loop can carry, and a producer whose inputs are unchanged has nothing new to say.

## Page hooks

A plugin registers a page hook. Hooks run in plugin order after every page has been classified and its frontmatter parsed, and before any page renders. A hook sees every page's URL, output path, source path, and frontmatter as written. It never sees rendered content. Rationale: a page's body renders with the globals that hooks define, so a hook reading bodies would need the result of the rendering it precedes.

A hook defines globals. A global a hook defines follows the rules for globals: the underscore class is reserved, and a name already defined by the configuration, a data file, or another hook is a build error naming both. Rationale: a collection listing a directory's pages under one name is the common case, and every rule that protects a variable's single home applies to it. A listing that shows each page's content gets it at render time, where a template reads the body through the render context (see: Render context).

## Reading and writing

A plugin reads source files through the context, never through the filesystem directly. A plugin never writes to the destination itself: every output reaches the destination as a handled file, an emitted file, or a page. Rationale: a read the build cannot see is a dependency it cannot track, and a write it does not perform escapes the uniqueness rule and the dev server alike.

A tool a plugin wraps may read files on its own, as a stylesheet compiler follows imports. The plugin then declares those files as inputs of its output (see: Dependencies).

## Dependencies

The build treats each of these as a unit of work with inputs: handling one static file, running one page hook, rendering one page, and producing one emitted file. A unit's inputs are everything it read through the context, every file it declared, and for a render the pages and templates of its chain and the globals it read. The build reruns a unit when any input changed and otherwise reuses its previous result (see: docs/specs/build.md, Incremental builds).

A plugin's obligations follow from that:

- Read through the context, so the read is recorded.
- Declare every file a wrapped tool read on its own.
- Give an emitted file a producer whose output is determined by its inputs, so reusing the previous output is correct.

A plugin that keeps state across units, such as a table of hashes filled by a file handler and read by a helper, keeps it through the context's reads instead. Rationale: state a plugin holds in memory is invisible to the build, so a change to the file behind it would not reach the pages that used it.

## Errors

A plugin reports a failure by throwing. There is no error return value. The build catches the throw and attributes it, so a plugin never writes its own name or the file it was working on into the message. A plugin never terminates the process. Rationale: only the build knows which unit was running, and a plugin that exits skips the attributed report and ends a dev-server session that should have waited for the next change.

A thrown error fails the unit it happened in and stops the build (see: docs/specs/build.md, Errors). The report names the plugin, the unit, and the file. For a render it names the file in the chain that was rendering when the throw happened, since a helper called from a template fails on the template's line. A renderer's syntax error carries the line and column the engine reports.

An error thrown while a plugin is set up fails the run before any unit starts. Rationale: an invalid option is caught once rather than on the first file that exercises it.

A plugin warns through the context's logger. A warning fails nothing.
