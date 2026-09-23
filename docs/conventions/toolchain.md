# Toolchain

Rules for the language, module system, and runtime the code is written against.

## Node floor

`engines` in `package.json` pins the oldest Node release the code supports. Set it to the oldest release that has everything the code relies on, and raise it when the code starts relying on something newer. Never add a polyfill, a loader, or a fallback path to support a release below the floor. Raise the floor instead. Rationale: the runtime ships type stripping, `require()` of ES modules, and a test runner, and each shim that reproduces one of those for an older release is a dependency and a build step carried by every user. A user on an older Node upgrades Node, which is cheaper than everyone carrying the shims.

## Modules

Every package is an ES module: `"type": "module"`, compiled with `module` and `moduleResolution` set to `NodeNext`. Relative imports name the source file with its `.ts` extension, and `rewriteRelativeImportExtensions` turns them into `.js` on emit. Rationale: Node requires explicit extensions in ES module imports and never rewrites them, so the choice is between writing the output's `.js` in the source or writing `.ts` and letting `tsc` rewrite. Writing `.ts` reads as what it is, and it lets Node's type stripping run the source directly, uncompiled, which tests and development use. Nothing is published as CommonJS. Rationale: a site on the supported Node floor can `require()` an ES module, so there is no consumer a CommonJS build would serve.

Rejected: dual publishing ESM and CommonJS. It doubles the build and the surface for packaging bugs for a consumer that does not exist.

## TypeScript

All code is TypeScript, compiled with `tsc`. Types are published from the same build so a site's configuration and a plugin's options are checked against them. Every entry point a site touches is typed at its boundary: the core package exports the configuration's type, and every plugin's factory takes a typed options object and returns the core plugin type. Rationale: a configuration file gets checked in the editor through the packages it imports, with no `tsconfig.json` of its own, only if every value it can hold carries a type.
