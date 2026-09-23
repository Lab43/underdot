# Migrating from v1

What to change in a site built on Underdot v1 so it builds on v2. Each entry names the behavior that changed and the edit a site makes for it, and points at the spec section that decided it. Behavior that is new but needs no edit is left out.

## Pages and URLs

- **`slug` is replaced by `_url`.** The page's identity is its URL: `/` for the home page, `/about/` for `about/index.html`. Replace `'/' + slug` with `_url`, and `slug === ''` with `_url === '/'`. A helper that compared `slug` compares `_url`. A template that built a sibling file's path from the slug, such as `` `/${slug}.jpg` `` for an image beside the page, builds it from `_url` with the trailing slash removed (see: docs/specs/source-tree.md, URLs).
- **Two sources writing one output path fail the build.** v1 kept whichever it met first. Rename or remove one of them (see: docs/specs/source-tree.md, Output paths are unique).

## Building

- **`index.js` becomes `underdot.config.ts`, or `underdot.config.js`.** The build script that constructed an `Underdot` instance and called `build()` is replaced by a module whose default export holds the same options and plugin list. The plugin setup, globals, and computed values such as srcset presets move over unchanged. The construction and the call go. `npm run build` runs `underdot build` and `npm run dev` runs `underdot dev` (see: docs/specs/configuration.md, Commands).
- **A script that runs more than one build keeps a script.** A project that built a second output, from a staged copy of the source or from a second source, calls the exported build function from its own script for each, instead of the command. The same script runs a dev-server session for the second output by calling the exported session function with the staged copy as its source, watching the original directories itself and re-staging when they change, so the session sees the change in the copy it watches (see: docs/specs/configuration.md, Programmatic use).
- **The `concurrency` option is gone.** The build chooses its own limit. A configuration that set one drops it (see: docs/specs/build.md, Concurrency).
- **`.DS_Store` files no longer reach the destination.** They are excluded by default, so the first v2 build removes the ones earlier builds copied. Expect them in the diff (see: docs/specs/configuration.md, Excluded files).
- **The destination is cleaned.** After a build the destination holds only what the build produced. A file that lives in the destination without a source, such as something a host wrote into a deployed directory, is deleted. Check the committed destination for such files before the first v2 build and move anything worth keeping into the source tree (see: docs/specs/build.md, Destination).
- **A failed build exits non-zero.** v1 stopped at the first error but exited with status zero. A deploy script that could not tell a failed build from a good one now can (see: docs/specs/build.md, Errors).

## Dev server

- **`server.js` and the live-reload script are deleted.** The dev command builds, serves, watches, and reloads the browser. A site that ran `nodemon` against the source drops that too (see: docs/specs/dev-server.md).
- **URL rewrites move to the configuration.** A server script that rewrote store routes such as `/cart` to a page that embeds the store lists those rewrites in the configuration, where the dev server applies them (see: docs/specs/configuration.md, Rewrites).
- **The port is a flag, not an environment variable.** A server script that read `PORT` is replaced by `underdot dev --port <n>`. Without the flag the session uses 3000, or the next free port when 3000 is busy (see: docs/specs/dev-server.md, Serving).
- **`404.ejs` renders to `/404.html`.** It used to render to `/404/index.html`. The dev server and static hosts serve the new path for a missing URL without configuration. A server rule that named the old path, such as an Apache `ErrorDocument`, points at `/404.html` (see: docs/specs/source-tree.md, Output paths).
- **HTTPS is a flag on the dev command.** A site that served itself over HTTPS makes its `dev` script `underdot dev --https`. The certificate and key stay where they are, `localhost.pem` and `localhost-key.pem` in the project root, generated per machine and ignored by git (see: docs/specs/dev-server.md, Serving).

## Templates and variables

- **A frontmatter key cannot share a registered helper's name.** A page with a key named like a helper, `srcset` or `busted` say, renames the key (see: docs/specs/plugins.md, Template helpers).
- **Data files move into `source/_data/`.** A build script that read a JSON file and passed it as a global drops that code, and the file moves to `source/_data/<name>.json`, where it defines the variable `<name>` (see: docs/specs/templates.md, Data files).

- **A global no longer overrides a template's frontmatter.** The order is globals, then templates from the root down, then the page. A site that relied on a global winning over a template's frontmatter moves the value into the page or the template (see: docs/specs/templates.md, Variables).
- **Relative paths in a template resolve against the template's own directory.** v1 resolved them against the page being rendered. A template include or helper path that only worked because of the page's location is rewritten relative to the template, or made absolute (see: docs/specs/templates.md, Relative paths).
- **`content` is now `_content`.** Every `<%- content %>` in a template becomes `<%- _content %>`. Built-in variables all start with an underscore, and a frontmatter key starting with an underscore is an error (see: docs/specs/templates.md, Reserved keys).
- **A template reading a value meant for it from a page it did not directly wrap reads `_chain[0]` instead.** The merged variables give the page's value; `_chain` gives each file's own (see: docs/specs/templates.md, Variables).
- **`dirname` is no longer a variable.** Helpers receive the current file's directory from the render context instead (see: docs/specs/plugins.md, Render context).
- **`locals.title` can become `title`.** An unset variable reads as absent instead of throwing, so the `locals.` prefix is no longer needed. Existing uses keep working (see: docs/specs/templates.md, Built-in variables).

## Plugin authors

Every plugin is rewritten for v2. The registrations keep their roles, and these are the changes that alter what a plugin does rather than how it is spelled.

- **A plugin has a name.** Give it one. Errors and dependency records cite it (see: docs/specs/plugins.md, Plugin identity and order).
- **Helpers and renderers receive a render context instead of the metadata object.** The context carries the page's URL, the path of the file being rendered, the merged variables, and the build's read and emit operations. A helper that resolved a relative path against `metadata.dirname` resolves it against the context's file directory, which is the template's own directory when a template is rendering (see: docs/specs/plugins.md, Render context).
- **A renderer must let a template read an unset variable without throwing.** The EJS plugin, for one, supplies every referenced name so `title` works where only `locals.title` did (see: docs/specs/plugins.md, Renderers).
- **State shared between a file handler and a helper goes through the build.** A handler that stored hashes or optimized SVGs in a closure for a helper to read drops that table. The helper reads the file's handled output through the context, so the build learns that the page depends on the file (see: docs/specs/plugins.md, Dependencies).
- **`enqueueFile` becomes emit, with inputs.** An emitted file names its producer's inputs by reading them through the context, and the producer runs only when an input changed. A helper that resized images on every build now resizes only when the source image or its parameters changed (see: docs/specs/plugins.md, Emitted files).
- **A wrapped tool's own reads are declared.** A handler wrapping a compiler that follows imports itself, as Sass does, declares the imported files as inputs of its output (see: docs/specs/plugins.md, Reading and writing).
- **No direct filesystem access.** Read source files through the context, never with `fs`, and never write to the destination. A helper that checked whether a file exists asks the context (see: docs/specs/plugins.md, Reading and writing).
- **Tree handlers become page hooks.** A hook receives every page's URL, output path, source path, and frontmatter, and never rendered content. It defines globals (see: docs/specs/plugins.md, Page hooks).
- **Collection items no longer carry `content`.** A template that embedded each item's body, as an archive or full-content feed does, reads the body through the render context at render time, so editing one post re-renders that post and the archive and nothing else. A collection plugin can wrap that read in a helper (see: docs/specs/plugins.md, Render context).

