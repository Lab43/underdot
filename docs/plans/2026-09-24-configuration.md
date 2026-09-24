---
status: pending
---

# Configuration

## Goal

Deliver checklist step 2.1: the exported `Configuration` type a site's configuration file is checked against, and the code that loads and resolves a configuration file into the value every later step builds from. After this plan a site can write `underdot.config.ts`, have a wrong setting fail in the editor and again at load time, and get absolute source and destination paths that the build's placement rules have already checked.

## Context

### What the repo holds today

- `src/index.ts:1` is `export {}`, and `src/index.test.ts:5-7` asserts the module has no exports. Phase 1 gives the module its first export, a type, which has no runtime presence, so the test's assertion stays true and only its name changes.
- `tsconfig.json:6` includes `src` and `plugins/*/src`. Phase 2 adds `test`, so the fixtures under it are typechecked.
- `package.json:41` is the test script, which measures coverage over `src/**` and `plugins/*/src/**` only. Fixtures under `test/` are outside it already, so Phase 2 changes nothing there.
- `eslint.config.js:118-119` applies `disableTypeChecked` to `eslint.config.js` alone. Any other `.js` file fails lint with a project-service error, proven by linting a `.js` fixture under `test/` on 2026-09-24. Phase 2 widens the block.
- `package.json:28-31` maps `exports` with `development` before `types`. A file under `test/` that imports `underdot` resolves through this map to `src/index.ts` under the typecheck, proven 2026-09-24 by running `tsc` over a probe fixture with `test` included: the import resolved and only a made-up member name failed. The same probe passed lint, so `n/no-extraneous-import` and `n/no-missing-import` accept a fixture importing the package by its own name.
- `README.md:22` is checklist plan 2.1, which this plan delivers whole. Phase 3 ticks it.
- `q-extension/conventions/configuration.md:5-7` tells a site to write the configuration in TypeScript so it is checked against the exported type. A `.ts` file with an untyped default export is checked against nothing, so the rule does not deliver its own rationale until Phase 3 sharpens it (see: Decision 10).
- `docs/conventions/testing.md` holds one section, Coverage. Phase 3 adds the fixture rule (see: Decision 8).

### What the specs commit to

- `docs/specs/configuration.md`, The configuration file: the file is `underdot.config.ts` or `underdot.config.js` in the project directory with the configuration as its default export, both present is an error, a command may point at a different file, a TypeScript file runs on Node's type stripping, an unknown setting is an error naming the setting before any work starts, and the configuration is data. Decisions 1, 3, and 4 honor these.
- `docs/specs/configuration.md`, Source and destination: the settings are paths relative to the project directory, the defaults are `source` and `build`, and the destination is checked against the build's placement rules before any work starts. Decisions 5 and 7.
- `docs/specs/configuration.md`, Excluded files: glob patterns under the source root the build treats as absent, with `.DS_Store` files everywhere excluded by default. Decision 6.
- `docs/specs/configuration.md`, Globals, Plugins, and Rewrites: three more settings, each consumed by a later step. Decision 1 leaves them to those steps.
- `docs/specs/configuration.md`, Programmatic use: the package exports the build and the session as functions taking a configuration. What those functions take is step 2.2's and step 8's call, and Decision 2 keeps this plan's public surface from pre-empting it.
- `docs/specs/build.md`, Destination: the destination is inside the project directory, is neither the project directory nor the source root, and neither the destination nor the source root contains the other, checked before any work starts. Decision 7.
- `docs/specs/dev-server.md`, Watching: a change to the configuration reloads it. Node caches a module by URL, and a query string on the import URL yields a fresh module, proven 2026-09-24 on Node 24.19. The loader imports by file URL so step 8 can add the query. Nothing here depends on it.

### What Node does with a configuration module

Proven 2026-09-24 in a scratch run on Node 24.19.0, outside the repo. Each bears on Decision 3.

- A dynamic `import()` of a `.ts` module holding `import type` from a package that does not exist, a `satisfies` clause, and a default export loads with no warning on stderr. The type import is erased, so it is never resolved at runtime.
- A `.js` module under a `"type": "module"` package loads with its `export default` as `default`. A `.js` module under a package with no `type` field, written as `module.exports`, loads with that object as `default`. Both spellings of a JavaScript configuration therefore reach the loader the same way.
- A `.ts` module under the operating system's temp directory strips fine. Only a path under `node_modules` is refused.
- A module with no default export imports with `default` undefined, which resolution rejects as a non-object configuration.
- The Node floor, `>=22.18.0`, strips types without a flag or a warning (source: docs/plans/2026-09-23-scaffolding.md, Which release lines the toolchain can stand on). Verification proves the loader on that release through the CI matrix.

### What an editor checks a site's file against

Read 2026-09-24 in VS Code's `typescript-language-features` source. With no `tsconfig.json`, the inferred project resolves modules with `moduleResolution: bundler` on TypeScript 5.4 and later, and `bundler` reads a package's `exports` map. A site's `import type { Configuration } from 'underdot'` therefore reaches `dist/index.d.ts` through the `types` condition at `package.json:31`. This is the premise of the payload rule Decision 10 sharpens. No top-level `types` or `main` field is needed for it (see: Out of scope).

### What the conventions fix

- `docs/conventions/principles.md`, A page is not its source file: a source file is read in one place and turned into a value, and every later stage works from the value. The configuration takes the same shape, with the loader as the one place the disk is read, so resolution takes a value and can be tested with one. Decision 8 rests on this.
- `docs/conventions/testing.md`, Coverage: every run holds 100% on lines, branches, and functions, and a whole file is excluded only through the test script's exclude list. The fixtures under `test/` are outside the include globs rather than excluded, so the list does not change.
- `@lab43/q conventions/specs.md`, Enforcement: the validation that rejects bad input and the test that proves it each carry a spec marker naming the section. Phases 1 and 2 mark every check and every test that enforces a section cited above.
- `@lab43/q conventions/extensions.md`, Which rules ship: a payload doc speaks to consuming sites and never names this repo's practices or layout, so the living exemplar the conventions rule would otherwise call for cannot be a fixture here. The sharpened rule in Phase 3 states the form in prose. Naming the package and its exported type is fine, since those are what a site sees.
- `@lab43/q conventions/conventions.md`, Code examples in conventions docs: a snippet in a conventions doc carries no import paths. The payload rule names the type and the `satisfies` keyword in prose for that reason.

## Decisions

1. **The `Configuration` type carries `source`, `destination`, and `exclude`, every one optional. `globals`, `plugins`, and `rewrites` arrive with the steps that consume them.** The type is what the loader checks a file against, and a setting the type names but nothing reads is one the loader would have to accept and ignore, which is the silent misfire the spec's unknown-setting rule exists to prevent. Until step 3 a configuration naming `plugins` fails as an unknown setting, which is correct: a build that cannot run plugins must not accept a list of them. Rejected: declaring every setting from the spec now, typed loosely, so that a site's file stops changing shape across steps. No site builds on the package before the rebuild ships, so there is no site to spare.

2. **`src/index.ts` exports the `Configuration` type and nothing else. `loadConfiguration`, `resolveConfiguration`, and the `ResolvedConfiguration` type are exports of `src/configuration.ts` that no index re-exports yet.** The README names the exported type as this plan's deliverable. What a script hands the build function, and whether a loader is public at all, are decisions the spec leaves to the functions that consume a configuration, and the plans for steps 2.2, 2.3, and 8 make them grounded in this code. Publishing a loader now would fix a signature those plans have not needed yet. Rejected: exporting the loader from the index so the command can reach it. The command lives in the same package and imports the module directly.

3. **`loadConfiguration(path?)` finds the file, imports it, and hands its default export to `resolveConfiguration`.** Given a path, the loader resolves it against the working directory, and the project directory is the directory holding that file, since the spec defines the project directory as the one holding the configuration. Given none, it looks for `underdot.config.ts` and `underdot.config.js` in the working directory. Both present is an error naming both. Neither present is an error naming both names and the directory. A given path that does not exist is an error naming it. The module is imported by its file URL, and its default export goes to `resolveConfiguration` as it is, with no check of the loader's own: a missing, null, array, or primitive export is rejected by resolution's non-object check (see: Decision 4), so the rule that a configuration is an object lives in one place. Rejected: taking the working directory as a second parameter for the tests' sake. The tests change directory instead, because a parameter no caller passes is a test hook in the public shape.

4. **`resolveConfiguration(configuration: unknown, projectDirectory)` validates and fills in. It rejects a value that is not an object, treating undefined, null, an array, and a primitive alike, with one error saying the configuration must be an object. It rejects a setting the type does not name, in one error naming every unknown setting. It rejects `source` or `destination` that is not a string and `exclude` that is not an array of strings, each an error naming the setting and what it must be.** The parameter is `unknown` because the value arrives from a file the type never saw, and a parameter typed `Configuration` would have the linter flag every runtime check as unnecessary. The unknown-setting check is the spec's. The shape check is not, and it stays because the type cannot protect a `.js` configuration or a `.ts` one that skipped the `satisfies` form, and `exclude` given as a string would reach the build as one pattern per character with no error anywhere. That is the silent misfire the spec's unknown-setting rationale names. Errors are plain `Error` values with the message as the whole report. How a failure is printed is step 2.3's. Rejected: an error class of this module's own, which step 2.3 would have to adopt before it has decided how failures print.

5. **The resolved form holds the project directory and absolute `source` and `destination` paths, resolved with `path.resolve` against the project directory, and the exclude list.** Every later step works from absolute paths, so the resolution happens once, here. An absolute value in the file stands as given, because `path.resolve` leaves it alone and the placement rules still bind it. Neither the source nor the destination is required to exist: the destination is created by the build, and a missing source is the build's failure to report when it walks it.

6. **A site's `exclude` list replaces the default `['**/.DS_Store']`.** The spec calls the pattern a default, and a default is what a setting replaces. The user ruled on this reading during planning. A site that lists its own patterns adds `**/.DS_Store` itself. Rejected: adding the site's patterns to the default, which the spec's rationale for the pattern argues for but its wording does not say. It would amend the spec, and the user chose not to.

7. **Placement is checked in `resolveConfiguration`, with `path.relative`.** The destination must be strictly inside the project directory, must differ from the source, and neither the source nor the destination may contain the other. A helper answers whether one absolute path is strictly inside another: the relative path from parent to child is non-empty, does not start with `..`, and is not absolute. Each violation is its own error naming the paths and the rule broken. The check lives in resolution rather than the loader so that whatever step 2.2 has the build function take, the rules run before any work starts.

8. **Test fixtures are directories under `test/fixtures/<subject>/`, one per filesystem case, and exist only where code touches the disk or a whole site proves an integrated build. Everything else is tested on values.** Resolution is a function from a value to a value, so every rule in Decisions 4 through 7 is a unit test passing an object literal. The loader is the one piece that reads the disk, and it gets one fixture directory per case the disk distinguishes: a TypeScript file, a JavaScript file, both present, neither, and a module with no default export. A fixture configuration is written exactly as a site writes one, `import type` and `satisfies` included, and is typechecked, so it doubles as the proof that a site's file checks against the type. Later steps put a source tree beside the configuration in the same shape, and a whole site shared by the build, incremental, and dev-server tests sits under the same root. Rejected: fixtures beside the test that owns them, in a `<name>.fixtures/` directory. A whole-site fixture has several owners, so the naming breaks at step 7, and the placement needs a typecheck exclude, a coverage exclude, and a lint ignore that a root outside `src/` does not. Rejected: writing fixture files into a temp directory at test time. Every reason for it was a tooling limit, and a fixture that is a file is what a reviewer can open and a site author can recognize.

9. **JavaScript files get untyped lint.** The block at `eslint.config.js:118` that disables type-aware rules for `eslint.config.js` widens to `**/*.js`. The typecheck never sees a `.js` file, `allowJs` being off, so the project service rejects one, and the general rule is cleaner than an ignore for the one fixture.

10. **The payload rule for writing the configuration in TypeScript says how the check happens: import the `Configuration` type with `import type` from the package, and mark the default export `satisfies Configuration`.** A `.ts` file with an untyped export is checked against nothing, so the existing rule's rationale, that a wrong setting fails as you type, holds only with the form stated. `satisfies` checks the literal against the type, rejects an unknown key, and keeps the literal's own inferred type. Rejected: a `defineConfig` helper that returns its argument typed. The spec says the configuration is data that runs nothing, and a helper is a function call for the sake of a type annotation. Rejected: a typed `const` re-exported as the default, which works but is two statements for one.

11. **Delivery is a single PR.** The change is one module, its tests, five small fixtures, two tooling edits, and three doc edits, which one review holds.

## Out of scope

- **`globals`, `plugins`, and `rewrites`.** Deferred to steps 3, 3, and 8, which consume them (see: Decision 1).
- **Matching the exclude patterns.** Deferred to step 2.2, which walks the source. This plan stores the patterns as strings and picks no glob syntax and no matcher.
- **A public loader.** Deferred to step 2.3, the command, which is the loader's first caller outside this module (see: Decision 2).
- **Reloading a changed configuration.** Deferred to step 8. The loader imports by file URL, and a query string on that URL is proven to yield a fresh module.
- **Checking that the source directory exists.** Declined. The build walks it and reports the failure with the attribution the build spec gives (see: Decision 5).
- **Top-level `types` and `main` fields in `package.json`.** Declined. VS Code's inferred project reads `exports`, so a site's editor check works without them, and no other editor's behavior was verified.
- **A CommonJS fixture.** Declined. A `module.exports` configuration is proven to load through the same import as an ES module, and the fixture would need its own `package.json` to switch the module kind. The ES module fixture covers the loader's `.js` path.

## Phases

### Phase 1: The type and resolution

1. Create `src/configuration.ts`. Export `interface Configuration` with optional `source: string`, `destination: string`, and `exclude: string[]`. Export `interface ResolvedConfiguration` with `projectDirectory`, `source`, `destination`, and `exclude`, all required. Export `resolveConfiguration(configuration: unknown, projectDirectory: string): ResolvedConfiguration` per Decisions 4 through 7, in this order: reject a non-object, reject unknown settings, check each setting's shape, apply the defaults `source` and `build` and `['**/.DS_Store']`, resolve the two paths, check placement. Keep the set of known setting names in one constant the unknown-setting check reads, so a later step adds a setting in one place. Give the non-object check, the unknown-setting check, the defaults, the exclude default, and each placement rule a `// spec:` marker naming its section.
2. Change `src/index.ts` to `export type { Configuration } from './configuration.ts';`. Rename the test in `src/index.test.ts` to say the module has no runtime exports, since a type export emits nothing.
3. Create `src/configuration.test.ts` with unit tests on `resolveConfiguration`, each passing an object literal: an empty object yields the defaults resolved under the project directory and the default exclude; each setting flows through; an absolute path stands; each unknown setting is named, and two unknown settings are both named in one error; each wrong shape is an error naming the setting; a site's exclude list replaces the default; each placement rule fails with its own error, covering a destination equal to the project directory, outside it, equal to the source, inside the source, and containing the source; undefined, null, an array, and a string each fail as a non-object configuration. Mark each test that proves a spec statement with the spec marker.
4. Run `npm run check`. Coverage reports `src/configuration.ts` at 100 on every column.

### Phase 2: The loader and the fixtures

1. Add `loadConfiguration(path?: string): Promise<ResolvedConfiguration>` to `src/configuration.ts` per Decision 3, using `fs/promises` to test for the files, `pathToFileURL` for the import, and `resolveConfiguration` for the rest. Mark the both-present check with the spec marker for The configuration file.
2. Create the fixtures under `test/fixtures/configuration/`: `ts-config/underdot.config.ts`, a configuration written as the payload rule prescribes with non-default `source`, `destination`, and `exclude` values, so the test proves the values flow through; `js-config/underdot.config.js`, an ES module default-exporting a non-default `source`; `both-present/` with both files, each a valid configuration; `no-config/.gitkeep`; and `no-default-export/underdot.config.ts`, a module with a named export only.
3. Change `tsconfig.json` to include `test` after `plugins/*/src`. Widen the `files` list at `eslint.config.js:118` to `['**/*.js']`.
4. Add loader tests to `src/configuration.test.ts`, each pointing at a fixture: the TypeScript fixture loads with its values resolved absolute under the fixture directory, which proves the project directory is the file's directory; the JavaScript fixture loads; the missing path fails naming it; and the module without a default export fails with resolution's non-object error, which proves the missing export reaches that check. Three tests exercise the default search, each changing the working directory to its fixture with a `t.after` that restores it: in `ts-config` the search finds the file; in `both-present` it fails naming both files; in `no-config` it fails naming both expected names and the directory. Mark the both-present test and the missing-export test with the spec marker for The configuration file.
5. Run `npm run check`. The typecheck now covers the fixtures, lint accepts the `.js` fixture, and coverage stays at 100 on every column.

### Phase 3: The docs

1. Through `/q:update-docs`: sharpen the rule at `q-extension/conventions/configuration.md:5-7` per Decision 10, stating the `import type` and `satisfies` form in prose, with the rationale that an untyped export is checked against nothing; add a Fixtures section to `docs/conventions/testing.md` carrying Decision 8 as a rule, with the rejected colocated placement; tick plan 2.1 at `README.md:22`.
2. Run `npm run check`.

## Verification

- The CI matrix passes on Node 22.18.0. The scratch run proved a dynamic import of a TypeScript configuration only on Node 24, and the floor's run of the loader tests is the proof for the release the package supports.
- After `npm run build`, run `npx tsc --noEmit --module preserve --moduleResolution bundler test/fixtures/configuration/ts-config/underdot.config.ts`. It passes, which is what a site's editor sees: the import resolves through `exports` to `dist/index.d.ts` with no `development` condition. Add a misspelled setting to a copy of the fixture and the same command fails naming it. Delete the copy.
- `npm pack --dry-run` lists `dist/index.d.ts` and no file under `test/`.
