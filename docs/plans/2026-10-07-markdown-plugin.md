---
status: completed
---

# The Markdown plugin

## Goal

Deliver checklist step 10: the workspace package `underdot-md`. Its renderer turns every `.md` page into HTML inside the page's template chain, and its helper renders a string of Markdown, such as a frontmatter value, from a template. After this plan a site that used v1's `underdot-md` builds on v2 with the edits the migration guide names.

## Context

### What a renderer and a helper may rely on, and what they owe the build

- A plugin registers a renderer for a file extension. The renderer turns a body and the variables into a string. It lets a template read a variable no file set without an error, and documents what that read yields (see: docs/specs/plugins.md, Renderers). `src/plugins/register-plugins.ts:8` is `Renderer = (body: string, context: RenderContext) => string | Promise<string>`. The body arrives with its frontmatter already removed (see: docs/specs/templates.md, Frontmatter).
- A page's body renders with the renderer for its extension, and each file in the chain renders with the renderer for its own extension, so a Markdown page renders inside an EJS template (see: docs/specs/templates.md, Rendering the chain).
- A template is a file whose extension has a registered renderer and whose name starts with an underscore. A file inside an underscore-prefixed directory is a static file whatever its extension (see: docs/specs/source-tree.md, Classification) (see: docs/specs/source-tree.md, Underscore prefix). So a file a renderer renders is a template exactly when its own name starts with an underscore.
- A template receives the output below it as `_content` (see: docs/specs/templates.md, Built-in variables).
- A helper is reachable by its name among the file's variables in every engine. It receives the render context ahead of the arguments written in the template, and returns synchronously (see: docs/specs/plugins.md, Template helpers). `src/plugins/register-plugins.ts:22` is `Helper = (context: RenderContext, ...args: unknown[]) => unknown`, so a helper narrows its own arguments.
- A plugin reports a failure by throwing and never writes its own name or the file into the message. The build reports a render's throw naming the plugin and the file in the chain that was rendering (see: docs/specs/plugins.md, Errors). `src/templates/render-pages.ts:69` builds that report as `Rendering <sourcePath> failed in <plugin>: <message>`.
- The same source, configuration, and plugins produce a byte-identical destination on every run and every machine (see: docs/specs/build.md, Determinism).

### What is already in place for a seventh package

- A plugin package under `plugins/<name>/` enforces `docs/specs/<name>.md`. Its `src/index.ts` exports the factory and the options type a site imports. The modules doing the work sit beside the entry, each named after its one function, with its test beside it (see: docs/conventions/structure.md, Directories).
- `plugins/svgo/` is the model package. `plugins/svgo/package.json` carries the root's `engines`, `files: ["dist"]`, the `exports` map of `development`, `types`, and `default`, and a `prepack` of `tsc -b tsconfig.build.json`. Its library is under `dependencies`, and `underdot` is a peer dependency at `^2.0.0-alpha.0` and a dev dependency at `file:../..`. `plugins/svgo/tsconfig.build.json` extends the base with `composite`, `rootDir: src`, `outDir: dist`, and a reference to the core's build config. `tsconfig.solution.json` lists each package's build config. `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, and `package.json`'s `workspaces` already cover every package under `plugins/`.
- `plugins/bust/src/index.ts:6` is a factory that takes no options and checks no argument.
- `plugins/svgo/src/inline-svg.ts:9-11` fails a helper argument that is not a string with `The reference must be a string, and ${String(reference)} is not.`.
- `test/helpers/make-render-context.ts` makes a stub `RenderContext` from a `sourcePath` and the fields a test sets.
- `src/build/bind-build.test.ts:360-369` builds the `svgo` fixture and holds the destination to its `expected/` through `expectDestination`, under the svgo spec's marker.

### What a v1 site relies on that v2 changes

The v1 plugin is `underdot-md` 1.0.1, read from `github.com/Lab43/underdot-md` on 2026-10-07 at the user's direction, for its surface alone. It depended on `marked` at `^4.0.18`. Its factory took `{ ext = 'md', ...options }`, passed `options` to marked's global `setOptions`, and registered two things:

- a renderer on `ext`, returning `marked.parse` of the body
- a helper `markdown(input)`, returning `marked.parse(input)`

marked 4.3.0, the newest v1 range resolves to, was run in a scratch directory on 2026-10-07. It gives every heading an `id` made from its text, so `# Welcome` renders as `<h1 id="welcome">Welcome</h1>`. It writes an email autolink such as `<a@b.com>` as character references chosen at random, so two parses of one file differ.

### What marked makes of a site's Markdown

The following was read from the registry and run against `marked` installed in a scratch directory on Node 24.19.0 and 22.18.0 on 2026-10-07.

- `marked` 18.1.0 is the latest. It is an ES module with no dependencies, `engines` of Node 20 or later, and its own types. Weekly downloads for the week ending 2026-10-04: marked 98.3M, markdown-it 34.6M.
- `new Marked()` makes an instance with marked's defaults, which share no state with any other instance. Its `parse(src, { async: false })` is typed as returning `string`, and the call without the flag is typed `string | Promise<string>`. A file making that call typechecks with the repo's `tsc` under `tsconfig.base.json`.
- The defaults render GitHub Flavored Markdown: tables, strikethrough, and bare-URL autolinks. A raw HTML block passes through as written. Headings carry no `id`. Link and image targets are written as given, so `[a](b.md)` is `<a href="b.md">a</a>`. An email autolink is written as plain text, `<a href="mailto:a@b.com">a@b.com</a>`.
- Every non-empty output ends with a newline. The empty string renders to the empty string. Each output below was the same bytes on both Node versions.
- `parse(undefined)` throws `marked(): input parameter is undefined or null` followed by a request to report it to marked's issue tracker.

## Decisions

1. **The package.** The naming rules and the model package are given (see: What is already in place for a seventh package). The v1 package was `underdot-md` and its helper was `markdown` (see: What a v1 site relies on that v2 changes). The user ruled that the package keeps its name, the helper keeps `markdown`, and the factory takes no options.

   **`plugins/markdown/` is the package `underdot-md` at `2.0.0-alpha.0`, described as `Markdown for Underdot`. It takes the shape of `plugins/svgo/package.json`, with `repository.directory` of `plugins/markdown` and `marked` at `^18.1.0` as its one dependency. Its `tsconfig.build.json` takes the shape of the svgo package's. `tsconfig.solution.json` gains a reference to it. `plugins/markdown/src/index.ts` exports `markdown(): Plugin`, which returns `{ name: 'markdown', renderers: { md: renderMarkdown }, helpers: { markdown: renderMarkdownText } }`. It has three modules beside it:**

   - **`parse-markdown.ts` holds one module-level `new Marked()` and exports `parseMarkdown(text: string): string`, which returns `marked.parse(text, { async: false })`.**
   - **`render-markdown.ts` exports the renderer `renderMarkdown(body: string, context: RenderContext): string`.**
   - **`render-markdown-text.ts` exports the helper `renderMarkdownText(context: RenderContext, text: unknown): string`.**

   **Every module carries a marker naming `docs/specs/markdown.md`.**

   The directory and the spec are named `markdown` because the plugin is, and a package directory is named after the spec it enforces. The package keeps v1's name so a migrating site changes only its import's shape. The plugin and the factory are named `markdown`, after the language, as `ejs` and `svgo` are named after theirs. The one instance lives in its own module because the renderer and the helper both parse, and an instance in each would be a copy. An instance of its own, rather than marked's shared `marked` export, keeps a site's other use of marked from changing what a page renders. The flag is passed on every call because without it the type is `string | Promise<string>`, and a renderer or helper narrowing that by hand would assert what the flag states. Rejected: options passing through to marked, v1's design. The spec would then commit to whatever each marked option means, and the EJS plugin dropped its pass-through for that reason. Rejected: an `ext` option. Which extension makes a page is a site's choice through the files it writes, as the EJS spec rules for its own extension. Rejected: markdown-it, with a third of marked's downloads and no site behind a switch.

2. **The renderer parses the body and refuses a template.** The renderer contract, the classification of templates, and `_content` are given (see: What a renderer and a helper may rely on, and what they owe the build), and so is marked's output (see: What marked makes of a site's Markdown). The user ruled that a Markdown template fails the build.

   **`renderMarkdown(body, context)` throws `A Markdown file cannot be a template, because Markdown has no way to place _content.` when `basename(context.sourcePath)`, from `node:path/posix`, starts with `_`. Otherwise it returns `parseMarkdown(body)`. It reads no variable.**

   Markdown has no syntax that prints a variable, so a Markdown template would replace every page beneath it with its own body. That output is never what an author means, and the build's report names the template as `Rendering _post.md failed in markdown: …`. The check reads the file's name because the source-tree rules make a rendered file with an underscore name a template and every other rendered file a page. A Markdown template that no page's chain reaches is never rendered, so it fails nothing. It produces nothing either. A body reads no variable, so the renderer contract's rule for an unset variable has nothing to apply to, and the spec says so. Links and image paths are written as the author typed them, as an EJS page's `src` attributes are. A relative one resolves in the browser against the page's URL and never against the source file. Rejected: rendering a Markdown template anyway. Rejected: interpolating variables into the body before parsing, which would make the plugin a second template engine for a need no site has stated.

3. **The helper renders a string and fails anything else.** The helper contract is given (see: What a renderer and a helper may rely on, and what they owe the build). marked's own error for `undefined` asks the author to report a bug to marked (see: What marked makes of a site's Markdown). The string check's message is given (see: What is already in place for a seventh package).

   **`renderMarkdownText(context, text)` throws `The text must be a string, and ${String(text)} is not.` when `text` is not a string. Otherwise it returns `parseMarkdown(text)`, a block of HTML ending with a newline, or the empty string for an empty one. It never reads the context.**

   The helper renders a block because v1's did, and a frontmatter value holding a paragraph or two is its use. A template calling it on a variable a page may omit fails the build naming the template, rather than printing nothing. A template that means to allow the absence checks for it first, as it would before printing any value. Rejected: returning the empty string for `undefined`, which hides a misspelled key. Rejected: an inline mode without the `<p>`, which no site has asked for.

4. **The spec.** Every statement in a spec is a commitment, with rationale inline where a decision would otherwise be reopened (see: @lab43/q conventions/specs.md, What a spec holds). Each plugin's spec is written inside the plan that builds it.

   **A new `docs/specs/markdown.md`, indexed in the agent briefing's Specs group after `docs/specs/srcset.md`, has an intro saying it holds what the Markdown plugin commits to: how a file renders, the one helper it registers, and that the plugin takes no options. It has three sections:**

   - **Rendering:**
     - The plugin is named `markdown` and registers a renderer for the `md` extension.
     - A body renders as GitHub Flavored Markdown, as marked renders it: tables, strikethrough, and bare-URL autolinks. Raw HTML passes through as written.
     - A heading carries no `id`.
     - An email autolink is written as plain text. *(deviation: the spec says a readable `mailto:` link, never character references. marked writes an `<a href="mailto:…">` anchor, so "plain text" misdescribed it.)*
     - Link and image targets are written as given.
     - The output is a function of the body and marked's version alone.
     - A body reads no variable.
     - Rendering a Markdown template is an error, with Decision 2's rationale.
   - **The helper:**
     - `markdown(text)` returns the text rendered as the Rendering section renders a body.
     - A `text` that is not a string is an error, with Decision 3's rationale.
   - **Options:** the factory takes none, with Decision 1's rationale.

   The spec is what the package's markers name and what a later change to the plugin is held to. "A function of the body and marked's version" commits to determinism and states plainly that a marked upgrade can change the output, as the svgo spec does for svgo.

5. **The whole-site fixture.** A test that builds a site with pages holds the destination to the fixture's `expected/` directory, and a fixture is a project directory written as a site writes it (see: docs/conventions/testing.md, Fixtures). The svgo fixture's test is the model (see: What is already in place for a seventh package). Run as the other outputs were (see: What marked makes of a site's Markdown), marked renders the two pieces of Markdown below to these bytes:

   - The body: `<h1>Welcome</h1>\n<p>Markdown with <strong>strong</strong> text, <del>struck</del> text, and a link to <a href="https://example.com">https://example.com</a>.</p>\n<table>\n<thead>\n<tr>\n<th>Plugin</th>\n<th>Renders</th>\n</tr>\n</thead>\n<tbody><tr>\n<td>ejs</td>\n<td><code>.ejs</code></td>\n</tr>\n<tr>\n<td>markdown</td>\n<td><code>.md</code></td>\n</tr>\n</tbody></table>\n<aside class="note">Raw HTML passes through.</aside>\n`.
   - The summary, `A *short* note on [Underdot](https://github.com/Lab43/underdot).`: `<p>A <em>short</em> note on <a href="https://github.com/Lab43/underdot">Underdot</a>.</p>\n`.

   **A new `test/fixtures/markdown/` is a site on `underdot-ejs` and `underdot-md`. Its `package.json` names the site `markdown-site` and makes it private and an ES module, with `underdot`, `underdot-ejs`, and `underdot-md` at `^2.0.0-alpha.0` under `dependencies`. Its `underdot.config.ts` imports `ejs` from `underdot-ejs` and `markdown` from `underdot-md` and lists `ejs()` then `markdown()`. `source/` holds two files:**

   - **`_.ejs`, with no frontmatter, is the lines `<!doctype html>`, `<html>`, `  <head>`, `    <title><%= title %></title>`, `  </head>`, `  <body>`, `    <header>`, `      <%- markdown(summary) -%>`, `    </header>`, `    <%- _content -%>`, `  </body>`, `</html>`, each ending with a newline.**
   - **`index.md`, with frontmatter `title: Home` and `summary: A *short* note on [Underdot](https://github.com/Lab43/underdot).`, and the body `# Welcome`, a blank line, `Markdown with **strong** text, ~~struck~~ text, and a link to https://example.com.`, a blank line, the table `| Plugin | Renders |`, `| --- | --- |`, ``| ejs | `.ejs` |``, ``| markdown | `.md` |``, a blank line, and `<aside class="note">Raw HTML passes through.</aside>`, ending with a newline.**

   **The one expected file is `expected/index.html`. It is `_.ejs` with `Home` as the title. The helper's line is replaced by `      <p>A <em>short</em> note on <a href="https://github.com/Lab43/underdot">Underdot</a>.</p>`, where marked's newline ends the line and the `-%>` drops the template's. The `_content` line is replaced by the body's output, with its first line at four spaces and the rest at column zero as marked writes them, and its last newline ending the line. `src/build/bind-build.test.ts` imports the fixture's configuration and gains a `describe` block for the `markdown` fixture after the srcset block, under a marker naming `docs/specs/markdown.md`, holding the build to `expected/` the way the svgo block does.**

   The page proves the renderer through a real build: a `.md` page renders inside an EJS template, and each GFM feature and the raw HTML block is visibly marked's. The summary proves the helper from a template through a real engine, on a frontmatter value as the helper's use is. Rejected: a Markdown template in the fixture, whose build would fail, so its proof belongs to the renderer's value tests and to Verification.

6. **Tests on values.** A function from a value to a value is tested on object literals, with a fixture only where the code touches the disk or a whole site proves an integrated build (see: docs/conventions/testing.md, Placement) (see: docs/conventions/testing.md, Fixtures).

   **`parse-markdown.test.ts` runs marked for real: the fixture body renders to its given output, the summary to its, and the empty string to the empty string. `render-markdown.test.ts` uses `makeRenderContext`: a page at `index.md` and one at `blog/post.md` render a body, and templates at `_.md` and `blog/_post.md` throw the template message. `render-markdown-text.test.ts` renders the summary, and `test.each` over `undefined`, `42`, and `null` throws the text message. `index.test.ts` tests the factory's shape, and makes one call through the registered renderer and one through the registered helper.** Running marked in the tests proves the plugin against the library it wraps. The renderer's and helper's tests prove only their own checks, and one end-to-end case each (see: docs/conventions/testing.md, Placement).

7. **The docs beyond the spec.** The payload carries rules for writing a site that the build cannot catch (see: @lab43/q conventions/extensions.md, Which rules ship). `q-extension/conventions/ejs.md:7` lists the helpers that return markup, to be printed with the raw tag. The migration guide names what a v1 site changes, each entry pointing at the spec section that decided it. Its last plugin section is The srcset plugin, at `docs/guides/migrating-from-v1.md:75-83`. The driving manual's section A site on the published packages packs the core and six plugins and drives five fixtures (`docs/guides/driving-manual.md:33-42`). `README.md:43` is step 10. What marked 4 wrote is given (see: What a v1 site relies on that v2 changes).

   **The EJS rule adds `markdown` from `underdot-md` to its list. The migration guide gains a section, The Markdown plugin, after The srcset plugin, with five entries:**

   - **The plugin is imported as `import { markdown } from 'underdot-md'` and listed as `markdown()`. Every option v1 passed to marked is dropped, and the helper keeps its name (see: docs/specs/markdown.md, Options).**
   - **`ext` is gone. A site that registered another extension renames those files to `.md` (see: docs/specs/markdown.md, Options).**
   - **A Markdown template fails the build. A `_*.md` template becomes EJS that prints `_content` (see: docs/specs/markdown.md, Rendering).**
   - **Headings no longer carry an `id`. A link to a heading's anchor writes that heading as HTML with the `id` (see: docs/specs/markdown.md, Rendering).**
   - **Every rendered page's bytes change once in the first v2 build, and again on a marked upgrade. An email autolink is now written as plain text rather than scrambled differently on every build. Expect both in a committed destination's diff (see: docs/specs/markdown.md, Rendering).** *(deviation: the entry says a readable `mailto:` link rather than "plain text", as the spec does, because marked writes an `<a href="mailto:…">` anchor.)*

   **The driving manual's section adds `underdot-md` to the packages a scratch copy cannot resolve, the packs in step 1, and the tarballs in step 3, so it packs the core and seven plugins. Its fixture list adds the `markdown` fixture as a site on `underdot-ejs` and `underdot-md`, and "the five runs together prove every plugin" becomes "the six runs". Step 2 copies the new fixture. The closing paragraph says the modules under `node_modules/underdot-md/dist/` import `marked` and nothing under `src/`. The README ticks step 10.**

   The helper's output is HTML for the reason `imageSet`'s is, so the existing rule is extended. The heading and email entries are the two changes marked 4 to 18 makes that a site can act on. Rejected: a README for the package, which publishing, out of scope since the scaffolding plan, will need and this plan does not.

8. **Delivery is a single PR in two phases.** The package with its tests and spec is one seam, reviewable alone and inert until a site lists it. The fixture with the docs around it is the second. The whole is a few hundred lines a reviewer holds in one sitting.

## Out of scope

- **Syntax highlighting of code blocks.** Declined. No site has asked for it, and it would bring a highlighter and its theme into the spec.
- **Variables or helpers inside a Markdown body.** Declined (see: Decision 2). A page that needs them is written in EJS.
- **Rewriting relative link and image targets against the source file.** Declined (see: Decision 2).
- **Another extension, such as `.markdown`.** Declined (see: Decision 1).

## Phases

### Phase 1: The package and the spec

1. Create `plugins/markdown/package.json` and `plugins/markdown/tsconfig.build.json` per Decision 1, in the shape of the svgo package's files. Add `{ "path": "./plugins/markdown/tsconfig.build.json" }` to `tsconfig.solution.json` after the helpers entry, keeping the list alphabetical. Run `npm install` to link the workspace and refresh the lockfile before anything else in this phase: lint, the type check, and the tests resolve `underdot-md` and `marked` only once the link exists.
2. Create `plugins/markdown/src/parse-markdown.ts`, headed with a marker naming `docs/specs/markdown.md`. Import `Marked` from `marked`, and export `parseMarkdown` per Decision 1.
3. Create `plugins/markdown/src/render-markdown.ts`, headed with the same marker. Import `basename` from `node:path/posix`, `RenderContext` as a type from `underdot`, and `parseMarkdown`. Export `renderMarkdown` per Decision 2: the template check, then the parse.
4. Create `plugins/markdown/src/render-markdown-text.ts`, headed with the same marker. Import `RenderContext` as a type from `underdot`, and `parseMarkdown`. Export `renderMarkdownText` per Decision 3: the string check, then the parse.
5. Create `plugins/markdown/src/index.ts`, headed with the same marker. Import `Plugin` as a type from `underdot`, `renderMarkdown`, and `renderMarkdownText`. Export `markdown` per Decision 1.
6. Create `parse-markdown.test.ts`, `render-markdown.test.ts`, `render-markdown-text.test.ts`, and `index.test.ts` beside their modules per Decision 6, each headed with the same marker. `index.test.ts` asserts `markdown()` equals `{ name: 'markdown', renderers: { md: expect.any(Function) }, helpers: { markdown: expect.any(Function) } }`.
7. Through `/q:update-docs`, create `docs/specs/markdown.md` per Decision 4 and index it in `CLAUDE.md`'s Specs group.
8. Run `npm run check`. Coverage reports every module under `plugins/markdown/src/` at 100 on every column. Run `npm run build` and confirm that `plugins/markdown/dist/` holds `index.js` and `index.d.ts` beside the three modules' files.

### Phase 2: The fixture and the docs

1. Create `test/fixtures/markdown/package.json`, `underdot.config.ts`, and the two source files per Decision 5.
2. In `src/build/bind-build.test.ts`, import the fixture's configuration and add the `describe` block per Decision 5.
3. Write `test/fixtures/markdown/expected/index.html` by hand from Decision 5, so it is a prediction a reviewer can check against the template and marked's given output rather than a copy of whatever the build produced. Then run the suite. A file that differs from what the build produces fails with a diff that shows whitespace. Reconcile the two by reading, and reach for `vitest --update` only once the difference is understood.
4. Through `/q:update-docs`, extend the EJS rule, add the migration guide's section, change the driving manual's section, and tick step 10 per Decision 7.
5. Run `npm run check`.

## Verification

- Follow the driving manual's revised section for the `markdown` fixture: pack the core, `underdot-ejs`, and `underdot-md`, copy `test/fixtures/markdown/` to a scratch directory, install the three tarballs in the copy, and run `npx underdot build` there. The command exits 0 and `diff -r <copy>/build test/fixtures/markdown/expected` shows nothing. The modules under the copy's `node_modules/underdot-md/dist/` import `marked` and nothing under `src/`.
- In the copy, rename `source/_.ejs` to `source/_.md` and build. It exits 1 and the report is `Rendering _.md failed in markdown: A Markdown file cannot be a template, because Markdown has no way to place _content.`.
- In the copy, restore `_.ejs`, remove `summary` from `index.md`, and build. It exits 1 and the report names `_.ejs`, the plugin `markdown`, and `The text must be a string, and undefined is not.`.
- CI passes on Node 22.18.0, which runs marked 18 on the floor.
