# Toolchain

Rules for the language, module system, and runtime the code is written against.

## Node floor

`engines` in `package.json` pins the oldest Node release the code supports. Set it to the oldest release that has everything the code relies on, and raise it when the code starts relying on something newer. Never add a polyfill, a loader, or a fallback path to support a release below the floor. Raise the floor instead. Rationale: the runtime ships type stripping, `require()` of ES modules, and a test runner, and each shim that reproduces one of those for an older release is a dependency and a build step carried by every user. A user on an older Node upgrades Node, which is cheaper than everyone carrying the shims.

Every plugin's manifest declares the same `engines` as the root. Rationale: the floor is enforced by lint, which reads the nearest manifest, so a plugin without the field is checked against no floor at all. A plugin publishes separately, and its consumers read its own manifest.

## Modules

Every package is an ES module: `"type": "module"`, compiled with `module` and `moduleResolution` set to `NodeNext`. Relative imports name the source file with its `.ts` extension, and `rewriteRelativeImportExtensions` turns them into `.js` on emit. Rationale: Node requires explicit extensions in ES module imports and never rewrites them, so the choice is between writing the output's `.js` in the source or writing `.ts` and letting `tsc` rewrite. Writing `.ts` reads as what it is, and it lets Node's type stripping run the source directly, uncompiled, which tests and development use. Nothing is published as CommonJS. Rationale: a site on the supported Node floor can `require()` an ES module, so there is no consumer a CommonJS build would serve.

Rejected: dual publishing ESM and CommonJS. It doubles the build and the surface for packaging bugs for a consumer that does not exist.

Every package's `exports` map carries a `development` condition pointing at its source entry, listed before `types`. Run tests and type checks under that condition, so neither needs a build and a plugin's tests exercise the core's source rather than its last build. Rationale: without the condition a plugin's import of `underdot` resolves to `dist`, and every test run waits on a compile of every package below it. `development` comes before `types` because TypeScript matches conditions in object order and always carries `types`, so a `types`-first map resolves to `dist` even under `customConditions`. Node never matches `types`, so the order changes nothing at runtime.

## TypeScript

All code is TypeScript, compiled with `tsc`. Types are published from the same build so a site's configuration and a plugin's options are checked against them. Every entry point a site touches is typed at its boundary: the core package exports the configuration's type, and every plugin's factory takes a typed options object and returns the core plugin type. Rationale: a configuration file gets checked in the editor through the packages it imports, with no `tsconfig.json` of its own, only if every value it can hold carries a type.

Pin `typescript` to major 6 until `typescript-eslint` declares support for TypeScript 7, then move. Rationale: the linter's type-aware rules run on the compiler's programmatic API, and TypeScript 7 ships none. The language, the errors, and the emitted JavaScript are the same in both, so the move is a version bump once the peer range admits it.
