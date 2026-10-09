---
status: completed
---

# PostCSS plugin

## Goal

Ship `underdot-postcss`, which is step 12 of the README's rebuild checklist. It is a file handler that runs a site's `.css` files through the PostCSS plugins the site lists. When `sass()` is listed first, it also picks up Sass's compiled output. A site gets prefixing, minification, and CSS `@import` inlining through its own choice of PostCSS plugins. The build hears about every file those plugins read, so a dev session recompiles a stylesheet when one of its imports changes.

## Context

How the build already composes a compiler and a post-processor, with no change to the core:

- **Matching after a rename.** Handlers run in plugin order. Each glob is matched against the path the handlers before it left, so a `.css` handler picks up what Sass renamed to `.css` (see: docs/specs/plugins.md, File handlers). `runHandlers` matches `current.outputPath` against each glob in turn (`src/plugins/run-handlers.ts:82`).
- **What a handler receives.** A handler gets a `HandlerContext { sourceDirectory, declareFile, warn }` (`src/plugins/run-handlers.ts:31-47`). A throw inside the handler is attributed as `Handling <sourcePath> failed in <plugin>: <message>` (`:88-92`).
- **The Sass handler.** It compiles `**/*.scss` to CSS at the same path with a `.css` extension. It hands Sass `join(sourceDirectory, outputPath)` as the stylesheet's location, and it declares every file Sass loaded (`plugins/sass/src/compile-sass.ts`; see: docs/specs/sass.md).
- **Errors and warnings.** An engine's own report passes through as it is. A plugin warns through `context.warn`, and Underdot adds no warnings of its own (see: docs/specs/plugins.md, Errors).
- **Verified behavior.** Every statement this plan makes about how PostCSS, its plugins, or Sass behave was run against `postcss` 8.5.29, `postcss-import` 17.0.0, `autoprefixer` 10.6.1, `@tailwindcss/postcss` 4.3.3, and `sass` 1.105.1 on Node 24.19.0, in a scratch install on 2026-10-08.

## Decisions

1. **Package and handler.**
   - **Name and dependency.** The plugin is `underdot-postcss`, with factory and plugin name `postcss`. It registers one handler for `**/*.css` and depends on `postcss` ^8.5.29.
   - **Why that name.** `underdot-postcss` is on npm at 1.0.1, maintained by `lab43` (`npm view underdot-postcss`, 2026-10-08), so v2 publishes under the existing name. `postcss` had 359,548,595 weekly downloads for 2026-09-28 to 2026-10-04.
   - **Every matching file is processed.** An underscore-prefixed static file, and every file inside an underscore-prefixed directory, passes through handlers, and its output is never written (see: docs/specs/source-tree.md, Underscore prefix). The handler processes every matching file, private ones included, and returns each at its own output path. A private CSS file's handled output is still read through the render context (see: docs/specs/plugins.md, Render context), so it should be the processed CSS.
   - **No partial rule.** Unlike Sass, the handler has no partial rule of its own. Sass needs one because a partial compiles to nothing on its own. A private CSS file processes on its own like any other, and its output is never written anyway. A file kept in `_css/` for import is therefore processed once as its own unit, unwritten, and again inlined into each stylesheet that imports it.

2. **The plugins option.** `postcss(plugins)` checks each entry when the processor is constructed. `postcss([123])` throws `123 is not a PostCSS plugin`, and `postcss(['autoprefixer'])` throws `autoprefixer is not a PostCSS plugin`. `postcss([])` returns the CSS unchanged and prints nothing. `postcss` ships its own types, including `AcceptedPlugin` and `Processor`.
   - **The option type.** The factory takes `options: PostcssOptions`, where `PostcssOptions { plugins: AcceptedPlugin[] }` is declared in and exported from `plugins/postcss/src/index.ts`.
   - **Validation.** The factory reads `options` and `options.plugins` as `unknown`, the values a JavaScript site can pass, and does not destructure the parameter. A missing options object, a `plugins` that is not an array, or an empty array throws `The plugins option must be an array of at least one PostCSS plugin.`
   - **One processor.** The factory then constructs one processor with `postcss(plugins)`, which every file reuses. Construction rejects any entry that is not a plugin with PostCSS's own message, so the configuration load fails rather than the first stylesheet.
   - **Why an empty list fails.** An empty list makes the plugin a silent no-op. Following the plugins spec's preference for an error over a report nobody reads (see: docs/specs/plugins.md, Errors), the plugin fails loudly instead.
   - **Rejected: loading `postcss.config.js` through `postcss-load-config`.** That would be a second configuration file, one the dev server does not watch and the configuration's type does not check. The factory option takes the same shape as svgo's `plugins` option.

3. **Paths handed to PostCSS.** Without `from`, PostCSS prints its own console notice: `Without `from` option PostCSS could generate wrong source map and will not find Browserslist config.` `postcss-import` resolves a relative `@import` against `dirname(from)`. Autoprefixer searches for its Browserslist config upward from `dirname(from)`.
   - **The call.** The handler processes `file.contents` as UTF-8 with `from` and `to` both set to `join(context.sourceDirectory, file.outputPath)`, and with `map: false`.
   - **Why that path.** It gives each plugin the stylesheet's directory on disk. Errors and warnings then name the file the author edits, or the path Sass renamed it to.
   - **Why `to` equals `from`.** The handler leaves the output path unchanged.
   - **Why `map: false`.** PostCSS writes no source map annotation, matching Sass's output (see: docs/specs/sass.md, The handler).

4. **Dependency messages become declared files, and a directory dependency is an error.**
   - **The facts this rests on.**
     - `postcss-import` reports each file it inlined as a message `{ type: 'dependency', plugin: 'postcss-import', file: <absolute path>, parent: <absolute path> }`. It never reports the stylesheet being processed.
     - `@tailwindcss/postcss` reports `dependency` messages for `node_modules/tailwindcss/index.css` and for every content file it scans. It also reports `dir-dependency` messages, `{ dir, glob }`.
     - `declareFile` throws `The handler declares ${JSON.stringify(path)}, which is not a plain path under the source root.` for a path that escapes the root. It throws `The handler declares ${path}, which the build does not see.` for a file absent from the file table (`src/plugins/run-handlers.ts:66-74`).
   - **Walking the messages.** After processing, the handler walks `result.messages` in order.
   - **A `dependency` message.** The handler declares `relative(context.sourceDirectory, message.file)`, written as `relative(...).split(sep).join('/')`, as Sass's handler does, so source paths are posix on every platform with no branch to cover. An import from `node_modules`, from beside the project, or of an excluded file then fails through `declareFile`. *(deviation: `postcss-import` resolves with `preserveSymlinks: false` and reports each file by its real path. With the source root behind a symlink, as every macOS temporary directory is, `relative(context.sourceDirectory, message.file)` climbed out of the root and every import failed. The handler declares `relative(await realpath(context.sourceDirectory), await realpath(message.file))` instead, and the spec's Dependencies section states that the report and the root are compared with symlinks resolved.)*
   - **A `dir-dependency` message.** It throws `PostCSS reports a dependency on the directory ${message.dir}, which the build cannot track.` The build has no way to declare a directory or a glob, and a stylesheet that ignored one would go stale, which the plugins spec rules out (see: docs/specs/plugins.md, Reading and writing).
   - **Every other message type.** It is ignored. A plugin's report of a candidate it tried and missed falls under the gap the build spec already states for imports a tool resolves itself (see: docs/specs/build.md, Incremental builds).
   - **Scope.** The sites this plugin serves run PostCSS plugins that transform the CSS they are given, and Tailwind is not among them.
   - **Rejected: skipping dependencies outside the root.** Tailwind would then half-work and go stale in a dev session.
   - **Rejected: skipping a dependency on the `from` path, as Sass skips its root.** No plugin in scope reports it. A plugin that did would fail loudly after a rename, through `declareFile`, rather than through a guard nobody exercises.

5. **Warnings go through the context, and errors propagate as they are.**
   - **The facts this rests on.** A plugin's `result.warn('careful', { node })` becomes a warning whose `toString()` is `w: /abs/path/site.css:1:1: careful`. That string carries the plugin name, the `from` path, the line and column, and the text. A syntax error rejects with a `CssSyntaxError` whose message is `/abs/path/site.css:1:1: Unclosed block`. A missing import rejects with `postcss-import: /abs/path/site.css:1:1: Failed to find 'missing.css'`, followed by the directories it searched.
   - **Warnings.** The handler calls `context.warn(warning.toString())` for each entry of `result.warnings()`, in order.
   - **Errors.** A rejection from `process` propagates unwrapped, as the plugin contract requires (see: docs/specs/plugins.md, Errors).

6. **Configuration that a plugin reads from outside the source root is treated as plugin code.**
   - **What the spec says today.** A change to a plugin's code takes a restart, and so does a change to a module a data module imports (see: docs/specs/build.md, Incremental builds). Nothing yet covers a file that a plugin's own code reads from disk outside the source, such as Autoprefixer's `.browserslistrc` at the project root.
   - **The amendment.** The build spec's Incremental builds section gains this rule: configuration a plugin reads from outside the source root, such as Browserslist's, is treated as the plugin's code. It is not watched, and changing it takes a restart.
   - **Why.** `declareFile` refuses a path outside the root, so no plugin can make that file an input. Data a plugin release carries, such as Autoprefixer's `caniuse-lite`, belongs to that release.
   - **What the PostCSS spec says.** Its Determinism section states that the output is a function of the stylesheet, the files it declared, the plugin list, and the installed releases with their own configuration, citing the amended section.
   - **Rejected: declaring the Browserslist file.** `declareFile` refuses it.

7. **The fixture proves the chain.** Sass passes a plain CSS import, such as `@import "../_css/reset.css";`, through to its output unchanged and reports no deprecation for it. That leaves something for `postcss-import` to inline.
   - **The fixture.** `test/fixtures/postcss/` lists `sass()` and then `postcss({ plugins: [postcssImport()] })`.
   - **Why `postcss-import`.** It exercises declared reads and depends on no data that changes over time. Autoprefixer's output would change with every `caniuse-lite` bump and churn the expected bytes.
   - **Where it is installed.** `postcss-import` and `@types/postcss-import` become root dev dependencies, not dependencies of `underdot-postcss`. The fixture is driven from `src/build/bind-build.test.ts` and type-checked by the root `tsconfig.json`, whose `include` takes in `test`. `@types/postcss-import` 14.0.3 types the package as `export = atImport`.

8. **Delivery.** One PR. The core is untouched, and the package, its spec, the build-spec amendment, the fixture, and the docs make one reviewable scope.

## Out of scope

- **Tailwind, and any plugin that reports `dir-dependency` or reads its dependencies outside the source root.** Deferred until a site needs one: the core would first need to declare directories, globs, and reads outside the source root, a change to the plugins spec. Until then decision 4 fails the build on them.
- **Source maps, and loading `postcss.config.js`.** Declined by decisions 3 and 2.

## Phases

### Phase 1: `underdot-postcss`

1. Add `plugins/postcss/`, wired the way `plugins/sass/` is:
   - **`package.json`.** Name it `underdot-postcss`, with the description `PostCSS for Underdot` and `postcss` ^8.5.29 as its dependency. Copy `engines`, `exports`, `files`, `prepack`, `peerDependencies`, and `devDependencies` from `plugins/sass/package.json`.
   - **`tsconfig.build.json`.** Copy it from `plugins/sass/`.
   - **`tsconfig.solution.json`.** Add a reference to the new package.
   - **Root dev dependencies.** Add `postcss-import` ^17.0.0 and `@types/postcss-import` ^14.0.3 to the root `devDependencies` (decision 7).
   - **Lockfile.** Run `npm install` to update the lockfile.
2. `plugins/postcss/src/index.ts` exports `PostcssOptions` and `postcss`. Import the `postcss` package's default export as `createProcessor`, so the name does not collide with the factory.
   - **The factory.** It validates the options and constructs the processor (decision 2). It returns `{ name: 'postcss', handlers: { '**/*.css': (file, context) => processCss(file, context, processor) } }`.
   - **`index.test.ts`.** It covers four cases:
     - The plugin's name and handler glob.
     - Each of the three bad options failing with decision 2's message: missing, not an array, and empty.
     - A non-plugin entry such as `'autoprefixer'` failing with PostCSS's message at setup.
     - The handler passing the file and context to a processor built from the given plugins.
3. `plugins/postcss/src/process-css.ts` exports `processCss(file: HandledFile, context: HandlerContext, processor: Processor): Promise<HandlerOutput[]>`. It carries out decisions 3, 4, and 5 top to bottom, importing `Processor` as a type from `postcss`. Its tests use processors built in the test from inline plugins, with contexts from `makeHandlerContext` (`test/helpers/make-handler-context.ts`). They cover:
   - The CSS returned at the same output path, as the plugins left it.
   - `from` and `to` set as decision 3 gives them, captured by an inline plugin reading `result.opts`.
   - A `dependency` message declared as a posix path under the source root.
   - A `declareFile` throw propagating.
   - A `dir-dependency` message failing with decision 4's message.
   - A message of another type ignored.
   - Each warning reaching `context.warn` as its `toString()`.
   - A `CssSyntaxError` propagating with PostCSS's message.
   - `postcss-import` resolving a relative import against the stylesheet's directory in `test/fixtures/postcss/source/`, with the inlined file declared. *(deviation: a tenth test covers a source root behind a symlink, with the dependency reported by its real path, for decision 4's deviation.)*
4. Write `docs/specs/postcss.md`, and give every module in the package its marker. The tests in steps 2, 3, and 7 carry `// spec: docs/specs/postcss.md` markers as the Sass package's and `the sass fixture`'s do (`src/build/bind-build.test.ts:377`, `:385`). The spec covers:
   - The handler and its glob, with every matching file processed, private ones included (decision 1).
   - The plugins option and its setup errors (decision 2).
   - The path handed to PostCSS, and no source map (decision 3).
   - Dependencies, the errors for an outside-the-root dependency and for a directory dependency, and the resolution gap, by reference to the build spec (decision 4).
   - Errors and warnings (decision 5).
   - Determinism (decision 6).
   - Running after Sass by plugin order, by reference to the plugins spec's File handlers section.
5. Amend `docs/specs/build.md`, Incremental builds, with decision 6's sentence. Put it beside the existing sentence on plugin code (`docs/specs/build.md:50`).
6. Add `test/fixtures/postcss/`:
   - **`package.json`.** It depends on `underdot`, `underdot-sass`, `underdot-postcss`, and `postcss-import`. The packed run in the driving manual installs from this file. The root dev dependency of decision 7 serves the in-repo test and type check.
   - **`underdot.config.ts`.** It holds `plugins: [sass(), postcss({ plugins: [postcssImport()] })]`.
   - **`source/styles/site.scss`.** It holds `@import "../_css/reset.css";` and a rule using a Sass variable.
   - **`source/_css/reset.css`.** A small reset rule.
   - **`source/styles/print.css`.** It holds `@import "parts/_base.css";` and a rule. In the scratch install, `postcss-import` resolved that bare relative form against the stylesheet's directory.
   - **`source/styles/parts/_base.css`.** It is processed as a private file and never written.
   - **`outside.css`.** It sits beside `source/`.
   - **`expected/`.** It holds `styles/site.css`, with the reset inlined ahead of Sass's output, and `styles/print.css`, with `_base.css` inlined.
7. Add `the postcss fixture` to `src/build/bind-build.test.ts`, following `the sass fixture` (`src/build/bind-build.test.ts:374-392`). It has two tests:
   - **The expected destination.** The build writes exactly `expected/`.
   - **An outside import.** Rewriting `source/styles/print.css` to `@import "../../outside.css";` fails the build with `Handling styles/print.css failed in postcss: The handler declares "../outside.css", which is not a plain path under the source root.`
8. Update the docs, every change through `/q:update-docs`, leaving them in the working tree with the phase:
   - **`docs/guides/migrating-from-v1.md`.** Add a `## The PostCSS plugin` section after the Sass one, each entry pointing at its spec section. It says:
     - Import from `underdot-postcss` and call `postcss({ plugins: [...] })`. `postcss.config.js` is not read.
     - List `sass()` ahead of it to post-process compiled CSS.
     - An import from outside the source root fails the build, and so does a directory dependency, which rules out Tailwind.
   - **`docs/guides/driving-manual.md`.** Make these changes:
     - Add `underdot-postcss` to the pack list in step 1, and the `postcss` fixture to the copy list in step 2.
     - In step 3, the `postcss` copy installs the core, `underdot-sass`, and `underdot-postcss` tarballs, and `postcss-import` from the registry. Its ejs exception reads "in every copy but `sass` and `postcss`".
     - In the paragraph that lists which fixture is a site on which packages (the one beginning "The compiled command cannot resolve"), add the `postcss` fixture as one on `underdot-sass` and `underdot-postcss`, and change "seven runs" to "eight runs". *(deviation: driving the Verification needed proof that an unrelated save reprocessed no stylesheet, which the destination cannot show when a rerun writes the same bytes. The dev server section gained how to prove it: a tracing plugin in the copy's configuration, appending each path it receives to a file outside `source/`.)*
     - In the paragraph listing what each copy's `dist/` imports, add that the `underdot-postcss` `dist/` imports `postcss` and nothing under `src/`.
   - **`CLAUDE.md`.** Add `docs/specs/postcss.md` to the specs index.
   - **`q-extension/`.** The site-facing payload gains nothing. The order rule belongs to the plugins spec, and the option is typed.
   - **Plan and README.** Mark this plan completed, and tick step 12 in the README.

## Verification

- **Packed build.** Drive the packed `underdot-postcss` on a scratch copy of `test/fixtures/postcss/`, per the driving manual. `underdot build` writes `styles/site.css` and `styles/print.css` matching `expected/`, and writes no `.scss` file, no `_base.css`, and nothing under `_css/`.
- **Dev session on that copy.**
  - Editing `_css/reset.css` rebuilds `styles/site.css` with the change and reloads.
  - Editing `styles/parts/_base.css` rebuilds `styles/print.css`.
  - A save to an unrelated file recompiles neither stylesheet.
  - Adding `@import "../../outside.css";` to `styles/print.css` shows the attributed failure in the terminal and the browser.
