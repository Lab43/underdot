# Driving manual

How to bring Underdot up and exercise it by hand: the compiled command, the published package, and the runtimes the package supports.

## The compiled command

Run the command from a copy of a fixture, never from a fixture itself, because a build writes the destination and nothing under `test/fixtures/` is ever written (see: docs/conventions/testing.md, Fixtures). Copy a fixture to a scratch directory, run `npm run build`, and from inside the copy run `node <repo>/dist/underdot.js build`. A successful build prints nothing and exits 0. Run `node <repo>/dist/underdot.js` with no arguments to see a usage error and its exit status of 2.

Pick the fixture by the surface being proved. `test/fixtures/defaults` is a site of static files alone. `test/fixtures/templated` has pages, templates, and a plugin of its own beside its configuration, so building it proves that the compiled command loads a type-stripped configuration that imports a sibling `.ts` module.

The tests run the shim from source under type stripping, so only this compiled run proves that the emitted file keeps its shebang and that its imports, rewritten from `.ts` to `.js`, resolve. That proof needs a full compile. Deleting `dist/` and running `npm run build` emits only the files whose source changed since the last build, because `tsconfig.build.tsbuildinfo` at the repo root survives the deletion and tells `tsc -b` the rest is current, and the command then fails with `Cannot find module .../dist/underdot.js`. Run `npx tsc -b tsconfig.solution.json --force` instead, or delete the build-info file along with `dist/`.

## The published package

`npm pack --dry-run` lists the files the package publishes but never the manifest, so it cannot show the `bin` field. To check the manifest, pack for real into a scratch directory with `npm pack --pack-destination <dir>` and read `package/package.json` out of the tarball. Packing runs the build first through `prepack`.

## The Node floor

`engines` names the oldest Node the package supports, and CI runs the suite on it, but a local run on the current Node proves nothing about the floor. Node versions installed under nvm live in `~/.nvm/versions/node/<version>/bin`. Put that directory first on `PATH` and run `npm test` to run the suite on the floor. Vitest reports the same way on every Node, so a filter written against one release's output reads the floor's too.
