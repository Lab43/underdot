# Driving manual

How to bring Underdot up and exercise it by hand: the compiled command, the published packages, and the runtimes they support.

## The compiled command

Run the command from a copy of a fixture, never from a fixture itself, because a build writes the destination and nothing under `test/fixtures/` is ever written (see: docs/conventions/testing.md, Fixtures). Copy a fixture to a scratch directory, run `npm run build`, and from inside the copy run `node <repo>/dist/underdot.js build`. A successful build prints nothing and exits 0. Run `node <repo>/dist/underdot.js` with no arguments to see a usage error and its exit status of 2.

Pick the fixture by the surface being proved. `test/fixtures/defaults` is a site of static files alone. `test/fixtures/templated` has pages, templates, data files, globals, and five plugins of its own: a renderer, two with file handlers, one with helpers, and one with a page hook. Building it proves that the compiled command loads a type-stripped configuration that imports sibling `.ts` modules, reads the globals and the data files into every page, runs every static file through the handlers whose globs match it in plugin order, renders every page through its template chain, resolves each template's includes through the render context, calls the helpers by name with the file being rendered bound in, reads handled output through them, composes the blog index from the hello post's rendered body, and lists every page on the pages page from the hook's global. The fixture's `expected/` directory holds what a correct build produces, so `diff -r <copy>/build test/fixtures/templated/expected` shows nothing after a correct build.

The tests run the shim from source under type stripping, so only this compiled run proves that the emitted file keeps its shebang and that its imports, rewritten from `.ts` to `.js`, resolve. That proof needs a full compile. Deleting `dist/` and running `npm run build` emits only the files whose source changed since the last build, because `tsconfig.build.tsbuildinfo` at the repo root survives the deletion and tells `tsc -b` the rest is current, and the command then fails with `Cannot find module .../dist/underdot.js`. Run `npx tsc -b tsconfig.solution.json --force` instead, or delete the build-info file along with `dist/`.

## The dev server

Run `node <repo>/dist/underdot.js dev` from a copy of a fixture, as the build command is run (see: The compiled command). Use a copy of `test/fixtures/templated`, whose pages, templates, and data files give an edit something to rebuild. The session prints `Serving http://localhost:3000/`, then `Network http://<address>:3000/` naming the machine's network address, then `Built in <n> ms` once the first build lands, and runs until interrupted. Either URL opens the site. The `Network` URL is reachable from a phone on the same Wi-Fi, once macOS has asked to allow `node` through the firewall on the first listen.

`--port <n>` takes that port, and fails when it is busy. Without it, a second session started in a second copy takes 3001, the next free port after 3000.

`--https` serves over HTTPS from `localhost.pem` and `localhost-key.pem` in the copy. Run `mkcert localhost` in the copy first, which writes both. Without them the session fails to start, naming the missing file and the command that generates it.

With a page open in the browser, an edit to a page under `source/` rebuilds and reloads it, and the terminal prints another `Built in` line. An edit that breaks a page, such as an unclosed frontmatter block, shows the build's report in an overlay in the browser and prints it in the terminal, and the page behind the overlay stays. Fixing the page reloads it. Without a browser, `curl -N <url>_underdot/events` prints the `building`, `failed`, and `built` events as they are sent.

One save can print two or more `Built in` lines on macOS. The watcher reports a single write as several change events, and an event that lands while a build runs holds one more build after it. The builds after the first reuse every unit and take a few milliseconds. To tell what a save reran, look at what the destination gained or what the page shows, never at the count of lines. A unit that reran and produced the same bytes leaves nothing to look at, so to prove that a save reran nothing, add to the copy's configuration a plugin whose handler appends each path it receives to a file outside `source/`, or for `underdot-postcss` a PostCSS plugin in its list that appends `result.opts.from`, and read that file after the save.

An edit to `underdot.config.ts` reloads the configuration and builds in full, so a rewrite added there serves after the next `Built in` line. A configuration that fails to load is reported the same way, and the previous configuration stays in force until the file loads again.

A module the configuration imports, such as a fixture's plugin module, is loaded once per session. An edit to it takes a restart.

## The published package

`npm pack --dry-run` lists the files the package publishes but never the manifest, so it cannot show the `bin` field. To check the manifest, pack for real into a scratch directory with `npm pack --pack-destination <dir>` and read `package/package.json` out of the tarball. Packing runs the build first through `prepack`, and packs `dist/` as it stands, so the output of a module that has since moved is still there beside its new location until `dist/` is deleted and rebuilt.

## A site on the published packages

The compiled command cannot resolve `underdot-ejs`, `underdot-bust`, `underdot-helpers`, `underdot-svgo`, `underdot-collections`, `underdot-srcset`, `underdot-md`, `underdot-sass`, or `underdot-postcss` from a scratch copy that installs nothing, so a site that uses a plugin is driven on the packed packages. That is also the one run that proves a plugin's `dist`, its `exports` map without the `development` condition, and its peer dependency. No one fixture uses every package: the `bust` fixture is a site on `underdot-ejs` and `underdot-bust`, the `helpers` fixture is one on `underdot-ejs` and `underdot-helpers`, the `svgo` fixture is one on `underdot-ejs` and `underdot-svgo`, the `collections` fixture is one on `underdot-ejs` and `underdot-collections`, the `srcset` fixture is one on `underdot-ejs` and `underdot-srcset`, the `markdown` fixture is one on `underdot-ejs` and `underdot-md`, the `sass` fixture is one on `underdot-sass` alone, and the `postcss` fixture is one on `underdot-sass` and `underdot-postcss`, so the eight runs together prove every plugin.

1. Pack the core and the plugins into a scratch directory that already exists, since `npm pack` does not create it: `npm pack --pack-destination <dir>` at the repo root, then `npm pack --workspace <plugin> --pack-destination <dir>` for `underdot-ejs`, `underdot-bust`, `underdot-helpers`, `underdot-svgo`, `underdot-collections`, `underdot-srcset`, `underdot-md`, `underdot-sass`, and `underdot-postcss`. Each pack runs its package's `prepack` build.
2. Copy `test/fixtures/bust/`, `test/fixtures/helpers/`, `test/fixtures/svgo/`, `test/fixtures/collections/`, `test/fixtures/srcset/`, `test/fixtures/markdown/`, `test/fixtures/sass/`, and `test/fixtures/postcss/` each to its own scratch directory.
3. In each copy, run `npm install` with the tarballs its `package.json` declares: `<dir>/underdot-2.0.0-alpha.0.tgz`, `<dir>/underdot-ejs-2.0.0-alpha.0.tgz` in every copy but `sass` and `postcss`, and the copy's own plugin, `<dir>/underdot-bust-2.0.0-alpha.0.tgz`, `<dir>/underdot-helpers-2.0.0-alpha.0.tgz`, `<dir>/underdot-svgo-2.0.0-alpha.0.tgz`, `<dir>/underdot-collections-2.0.0-alpha.0.tgz`, `<dir>/underdot-srcset-2.0.0-alpha.0.tgz`, `<dir>/underdot-md-2.0.0-alpha.0.tgz`, or `<dir>/underdot-sass-2.0.0-alpha.0.tgz`. The `postcss` copy installs both `<dir>/underdot-sass-2.0.0-alpha.0.tgz` and `<dir>/underdot-postcss-2.0.0-alpha.0.tgz`, and `postcss-import` from the registry.
4. In each copy, run `npx underdot build`. It exits 0, and `diff -r <copy>/build test/fixtures/<fixture>/expected` shows nothing. Run the `helpers` copy as `TZ=America/Los_Angeles npx underdot build`, which proves the UTC pin against the compiled package on a machine formatting in another zone.

The copy's `node_modules/underdot-ejs/dist/index.js` imports `ejs` and nothing under `src/`, its `node_modules/underdot-bust/dist/index.js` imports nothing under `src/`, the modules under `node_modules/underdot-helpers/dist/` import `date-fns` and `@date-fns/tz` and nothing under `src/`, the modules under `node_modules/underdot-svgo/dist/` import `svgo` and nothing under `src/`, the modules under `node_modules/underdot-collections/dist/` import nothing under `src/`, the modules under `node_modules/underdot-srcset/dist/` import `sharp` and `image-size` and nothing under `src/`, the modules under `node_modules/underdot-md/dist/` import `marked` and nothing under `src/`, the modules under `node_modules/underdot-sass/dist/` import `sass` and nothing under `src/`, and the modules under `node_modules/underdot-postcss/dist/` import `postcss` and nothing under `src/`.

The `srcset` fixture's derivatives under `expected/` are the build's output, which no one writes by hand, so a sharp upgrade that changes them is regenerated from a build:

1. Build a scratch copy of the fixture on the upgraded packages, as above.
2. Open each derivative under the copy's `build/images/` with sharp's `metadata()`, and confirm its format and its width and height against the element in `expected/index.html` that names it.
3. Copy the derivatives into `test/fixtures/srcset/expected/images/`.

## The Node floor

`engines` names the oldest Node the package supports, and CI runs the suite on it, but a local run on the current Node proves nothing about the floor. Node versions installed under nvm live in `~/.nvm/versions/node/<version>/bin`. Put that directory first on `PATH` and run `npm test` to run the suite on the floor. Vitest reports the same way on every Node, so a filter written against one release's output reads the floor's too.
