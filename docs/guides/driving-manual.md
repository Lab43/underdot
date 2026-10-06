# Driving manual

How to bring Underdot up and exercise it by hand: the compiled command, the published packages, and the runtimes they support.

## The compiled command

Run the command from a copy of a fixture, never from a fixture itself, because a build writes the destination and nothing under `test/fixtures/` is ever written (see: docs/conventions/testing.md, Fixtures). Copy a fixture to a scratch directory, run `npm run build`, and from inside the copy run `node <repo>/dist/underdot.js build`. A successful build prints nothing and exits 0. Run `node <repo>/dist/underdot.js` with no arguments to see a usage error and its exit status of 2.

Pick the fixture by the surface being proved. `test/fixtures/defaults` is a site of static files alone. `test/fixtures/templated` has pages, templates, data files, globals, and five plugins of its own: a renderer, two with file handlers, one with helpers, and one with a page hook. Building it proves that the compiled command loads a type-stripped configuration that imports sibling `.ts` modules, reads the globals and the data files into every page, runs every static file through the handlers whose globs match it in plugin order, renders every page through its template chain, resolves each template's includes through the render context, calls the helpers by name with the file being rendered bound in, reads handled output through them, composes the blog index from the hello post's rendered body, and lists every page on the pages page from the hook's global. The fixture's `expected/` directory holds what a correct build produces, so `diff -r <copy>/build test/fixtures/templated/expected` shows nothing after a correct build.

The tests run the shim from source under type stripping, so only this compiled run proves that the emitted file keeps its shebang and that its imports, rewritten from `.ts` to `.js`, resolve. That proof needs a full compile. Deleting `dist/` and running `npm run build` emits only the files whose source changed since the last build, because `tsconfig.build.tsbuildinfo` at the repo root survives the deletion and tells `tsc -b` the rest is current, and the command then fails with `Cannot find module .../dist/underdot.js`. Run `npx tsc -b tsconfig.solution.json --force` instead, or delete the build-info file along with `dist/`.

## The published package

`npm pack --dry-run` lists the files the package publishes but never the manifest, so it cannot show the `bin` field. To check the manifest, pack for real into a scratch directory with `npm pack --pack-destination <dir>` and read `package/package.json` out of the tarball. Packing runs the build first through `prepack`, and packs `dist/` as it stands, so the output of a module that has since moved is still there beside its new location until `dist/` is deleted and rebuilt.

## A site on the published packages

The compiled command cannot resolve `underdot-ejs`, `underdot-bust`, `underdot-helpers`, or `underdot-svgo` from a scratch copy that installs nothing, so a site that uses a plugin is driven on the packed packages. That is also the one run that proves a plugin's `dist`, its `exports` map without the `development` condition, and its peer dependency. No one fixture uses every package: the `bust` fixture is a site on `underdot-ejs` and `underdot-bust`, the `helpers` fixture is one on `underdot-ejs` and `underdot-helpers`, and the `svgo` fixture is one on `underdot-ejs` and `underdot-svgo`, so the three runs together prove every plugin.

1. Pack the core and the plugins into a scratch directory: `npm pack --pack-destination <dir>` at the repo root, then `npm pack --workspace <plugin> --pack-destination <dir>` for `underdot-ejs`, `underdot-bust`, `underdot-helpers`, and `underdot-svgo`. Each pack runs its package's `prepack` build.
2. Copy `test/fixtures/bust/`, `test/fixtures/helpers/`, and `test/fixtures/svgo/` each to its own scratch directory.
3. In each copy, run `npm install` with the tarballs its `package.json` declares: `<dir>/underdot-2.0.0-alpha.0.tgz`, `<dir>/underdot-ejs-2.0.0-alpha.0.tgz`, and the copy's own plugin, `<dir>/underdot-bust-2.0.0-alpha.0.tgz`, `<dir>/underdot-helpers-2.0.0-alpha.0.tgz`, or `<dir>/underdot-svgo-2.0.0-alpha.0.tgz`.
4. In each copy, run `npx underdot build`. It exits 0, and `diff -r <copy>/build test/fixtures/<fixture>/expected` shows nothing. Run the `helpers` copy as `TZ=America/Los_Angeles npx underdot build`, which proves the UTC pin against the compiled package on a machine formatting in another zone.

The copy's `node_modules/underdot-ejs/dist/index.js` imports `ejs` and nothing under `src/`, its `node_modules/underdot-bust/dist/index.js` imports nothing under `src/`, the modules under `node_modules/underdot-helpers/dist/` import `date-fns` and `@date-fns/tz` and nothing under `src/`, and the modules under `node_modules/underdot-svgo/dist/` import `svgo` and nothing under `src/`.

## The Node floor

`engines` names the oldest Node the package supports, and CI runs the suite on it, but a local run on the current Node proves nothing about the floor. Node versions installed under nvm live in `~/.nvm/versions/node/<version>/bin`. Put that directory first on `PATH` and run `npm test` to run the suite on the floor. Vitest reports the same way on every Node, so a filter written against one release's output reads the floor's too.
