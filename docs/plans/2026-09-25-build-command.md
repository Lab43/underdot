---
status: completed
---

# Build command

## Goal

Deliver checklist plan 2.3: the `underdot` executable with its `build` subcommand. The command loads the configuration from the working directory or from a `--config` path, runs the build the package already exports, exits non-zero when the build fails, and prints the failure. After this plan a site's `build` script is `underdot build`, and checklist step 2 is complete.

## Context

### Where the loader and the build fail to meet

- `src/build/build.ts:13-18` is `build(configuration: Configuration, projectDirectory = process.cwd())`. It resolves the configuration itself at line 14, then walks, excludes, classifies, plans, and writes. The command cannot call it with what the loader returns, which is the tension Decision 1 resolves.
- `src/configuration/load-configuration.ts:46-50` is `loadConfiguration(path?)`, returning a `ResolvedConfiguration`. Given no path it searches `process.cwd()` at line 47, and given one it resolves it against the working directory and takes the file's directory as the project directory. Nothing calls it yet. Decision 2 makes the command its first caller, unchanged.
- `src/configuration/resolve-configuration.ts:11-16` is the `ResolvedConfiguration` type: the project directory, absolute `source` and `destination`, and the exclude list. Decision 1 makes it the input of the build's inner function.
- `src/index.ts:1-2` exports the `Configuration` type and `build`. Nothing in this plan changes the package's exports.

### What the executable must satisfy

- `package.json:24-27` lists `dist` and `q-extension` as the published files, and the manifest has no `bin` field. Phase 2 adds the field pointing into `dist`.
- `package.json:36` is the build script, `tsc -b tsconfig.solution.json`. Proven 2026-09-25 in a scratch compile on TypeScript 6.0: `tsc` keeps a `#!` line as the first line of the emitted file, and both the emitted file and the type-stripped source run under `node`. Decision 5 rests on this.
- `package.json:41` is the test script. Its coverage globs include `src/**` and exclude `**/*.test.ts`. Proven 2026-09-25 by running one test file with a source file no test imports: that file is absent from the coverage report rather than reported at zero, and a second `--test-coverage-exclude` flag is accepted. Decision 5 lists the shim in the exclude list so the exclusion is visible, and Phase 2 records the finding in the testing convention.
- `eslint.config.js:35` applies `eslint-plugin-n`'s recommended set, which enables `n/hashbang` and `n/no-process-exit`, and `eslint.config.js:49-53` is the block holding the project's own `n/` rules. Proven 2026-09-25 by linting a probe shim in a scratch copy of the repo's lint setup: with no `bin` field the rule reports a shebang as unneeded, with `bin` naming `dist/underdot.js` and no path mapping it still does, and with the rule's `convertPath` option mapping `src/**/*.ts` onto `dist/**/*.js` the shim passes and the same shim without its shebang fails. The rule compares the linted file's converted path against `bin`. Phase 2 configures the mapping.
- Proven 2026-09-25 by linting a probe under the repo's floor rule on `>=22.18.0`: `parseArgs` from `node:util`, `process.exitCode`, `process.stderr.write`, and `execFile` from `node:child_process` all pass. Decisions 3, 4, and 6 use them.
- `no-console` is an error at `eslint.config.js:86`. The command writes with `process.stderr.write`.

### What the specs commit the command to

- `docs/specs/configuration.md`, Commands: `underdot build` builds the site and exits non-zero when the build fails, and both commands accept a path to a configuration file in place of the default. Decisions 3 and 4.
- `docs/specs/configuration.md`, The configuration file: a command may be pointed at a different file, and the project directory is the directory holding the configuration. The loader already honors this, and Decision 2 keeps it the one place that reads the file.
- `docs/specs/configuration.md`, Programmatic use: what the exported build function does is what the command does. Decision 1 keeps one body of work under both.
- `docs/specs/build.md`, Errors: run on its own, the build exits with a non-zero status, and a failed build leaves whatever it had written. Decision 4.
- `docs/specs/plugins.md`, Errors: a plugin never terminates the process. Decision 2 gives the shim, and nothing below it, the exit status.
- `docs/plans/2026-09-24-configuration.md`, Decision 4: errors are plain `Error` values with the message as the whole report, and how a failure is printed was left to this plan. Decision 4.
- `docs/guides/migrating-from-v1.md:12` already tells a site that `npm run build` runs `underdot build`, and its Building section already records the non-zero exit. The guide needs no entry from this plan.

### What the runtime's parser does

Proven 2026-09-25 in a scratch run on Node 24.19.0 with `parseArgs({ args, options: { config: { type: 'string' } }, allowPositionals: true, strict: true })`. Each bears on Decisions 3 and 4.

- `['build']` yields the positional `build` and no values. `['build', '--config', 'x.ts']`, `['--config', 'x.ts', 'build']`, and `['build', '--config=x.ts']` all yield the positional and `config: 'x.ts'`.
- `[]` yields no positionals, and `['build', 'extra']` yields both positionals. Neither throws.
- `['build', '--config']` throws with code `ERR_PARSE_ARGS_INVALID_OPTION_VALUE` and the message `Option '--config <value>' argument missing`.
- `['build', '--foo']` and `['build', '-c', 'x']` throw with code `ERR_PARSE_ARGS_UNKNOWN_OPTION`. The message names the option and then explains how to pass a positional starting with a dash.

### How the tests can drive a process

Proven 2026-09-25 in a scratch `node:test` run on Node 24.19.0. Each bears on Decision 6.

- `t.mock.method(process.stderr, 'write', () => true)` captures every write's arguments for the test's duration and is restored after it.
- `promisify(execFile)(process.execPath, [script])` rejects when the script sets `process.exitCode = 2`, and the rejection carries `code: 2` and the script's stderr as `stderr`.
- A module whose body is `throw 'nope';` rejects its dynamic import with the string itself.

### How the modules and tests must be shaped

- `docs/conventions/toolchain.md`, Modules: a module exporting one function is named after it, modules live in a directory named after the spec they enforce, and `src/index.ts` stays at the root as the package entry. Decision 5 puts the shim beside the entry and Phase 2 amends the section to say so.
- `docs/conventions/testing.md`, Coverage: every run holds 100% on every column, and a whole file is excluded only through the test script's exclude list. Decision 5.
- `docs/conventions/testing.md`, Fixtures and Helpers: a fixture is a project directory under `test/fixtures/<case>/`, never written, copied with `copyFixture` from `test/helpers/copy-fixture.ts` by a test that builds. `test/helpers/change-directory.ts` changes the working directory for one test and restores it. `test/fixtures/no-config/` holds no configuration file, and `test/fixtures/ts-config/underdot.config.ts` names a source root `content` that does not exist. Decision 6 reuses both fixtures.
- `@lab43/q conventions/specs.md`, Enforcement: a file enforcing one section of a spec carries one marker naming it, and a blank line follows the marker. Phases 1 and 2 mark each new file once, on the line after the shebang where there is one.
- `README.md:21` is checklist step 2 and `README.md:24` is plan 2.3, the last of the step's three plans. Phase 2 ticks both.

## Decisions

1. **`build` keeps its signature and splits. A new `runBuild(configuration: ResolvedConfiguration): Promise<void>` in `src/build/run-build.ts` holds the walk, the exclusion, the classification, the planning, and the write. `build` resolves and calls it. The command loads the configuration and calls `runBuild` with the loader's result.** The public function stays what the spec names, a function taking a configuration, and resolves for every script that calls it. The command reaches the same work through the resolved form the loader already produces, so the file is read once and resolved once. The dev-server session in step 8 reloads the configuration and rebuilds, and it takes the same seam. `runBuild` gets a test beside it, as every module does, proving it builds from a resolved value. The build's own tests keep proving resolution and the default project directory. Rejected: the loader returning the raw export with its directory for the command to pass to `build`, which resolves the value twice and needs the resolver to act as a type guard for the raw value to type as a `Configuration`. *(deviation: the inner function is `build` in `src/build/build.ts`, taking a `ResolvedConfiguration`, and the public signature lives in `src/index.ts` as a thin call into it. `runBuild` named the pipeline for its caller rather than for what it does, and a wrapper too thin to be a module belongs in the entry. The toolchain convention's Modules section records the shape.)*

2. **`runCommand(args: string[]): Promise<number>` in `src/configuration/run-command.ts` is the command. It takes the arguments after the script name, writes to `process.stderr`, and returns the exit status. The shim assigns that status to `process.exitCode`.** The status is a value a test asserts on without a process, and the writes are captured by mocking the stream for the test's duration. `process.exit` is refused by lint and can cut off a pending write. The command lives under `src/configuration/` because the Commands section of the configuration spec is what it enforces. Rejected: a stream parameter for the tests' sake, which is a test hook in the shape, since the shim would pass `process.stderr` and nothing else ever would.

3. **Arguments are parsed with `parseArgs` from `node:util`, in strict mode with positionals allowed and one option, `config`, of type string. The first positional is the subcommand, and `build` is the only one until step 8 adds `dev`.** The runtime's parser handles the whole surface the spec names, so a parsing dependency would buy nothing. Rejected: `commander` or `yargs`, a dependency and a second vocabulary for one subcommand and one option. *(deviation: parsing is its own module, `parseCommand` in `src/configuration/parse-command.ts`, returning a typed `Command` and throwing a usage error whose message is the reason. `runCommand` parses, reports a usage error with the usage line, and dispatches on the typed value, so the command's shape is checked once and the shim stays one statement. The seam is where `underdot dev` will join.)*

4. **Three exits, and what each prints.** A usage error prints one line stating the reason, then the usage line `Usage: underdot build [--config <path>]`, and returns 2. The reasons are no subcommand, an unknown subcommand, a second positional, and a parser error, whose message is printed as the parser gives it. A build failure, which includes a configuration that fails to load or resolve, prints the error's message and returns 1. An error that is not an `Error` prints as `String(error)`. A successful build prints nothing and returns 0. The message is the whole report, as the configuration plan decided, so nothing is added to it: no prefix, and no stack. Usage errors take 2 and failures 1 so a script can tell a mistyped invocation from a bad site. Rejected: rewriting the parser's messages, which restates what the runtime already says. Rejected: printing a stack, which serves a bug in Underdot rather than a fault in the site, and can be added when such a bug needs it.

5. **The executable is `src/underdot.ts`, at the root beside `src/index.ts`, published as `dist/underdot.js` through a `bin` field. It is the shebang, the spec marker, and one statement: assign the awaited `runCommand(process.argv.slice(2))` to `process.exitCode`, with top-level `await`.** It exports nothing, so it is named after the command it installs rather than a function. It is the package's second entry, and the toolchain convention's Modules section is amended to place it with the first. Its own process is never measured, so the test script's exclude list names it, and the listing is what makes the exclusion visible. *(deviation: the runner merges a spawned process's coverage into the report, so the shim is measured through its spawn test at 100 on every column, on the floor as on the current release. The exclude was dropped, and the shim is held to the threshold like every module.)* The `n/hashbang` rule reads `bin` against the compiled path, so the rule is configured with a `convertPath` mapping `src/**/*.ts` onto `dist/**/*.js`. Rejected: a `src/bin/` directory, a directory for one file.

6. **The command is proven on fixture copies, and the executable by spawning it.** `src/configuration/run-command.test.ts` copies a fixture, changes the working directory into the copy where the case needs it, mocks `process.stderr.write`, and asserts the return value and the writes. `src/underdot.test.ts` runs `node src/underdot.ts` with `execFile` against a fixture copy, once succeeding and once failing usage, and asserts the exit status and stderr. Type stripping runs the shim from source, so the test needs no build. A new fixture, `test/fixtures/throwing-config/`, holds a JavaScript configuration whose body throws a string, which is the one way to reach the non-`Error` report. Rejected: proving the executable only in Verification against the compiled output, which leaves the exit status unproven on every test run.

7. **Delivery is a single PR.** The change is two new modules, one moved function body, a shim, three test files, one fixture, three tooling edits, and three doc edits, which one review holds. No seam in it would ship on its own: the command is nothing without the shim, and the shim nothing without the command.

## Out of scope

- **`underdot dev`.** Deferred to step 8. Until then it is an unknown subcommand.
- **A `--help` flag.** Declined. Every usage error prints the usage, and an invocation with no subcommand is one of them.
- **A short alias for `--config`.** Declined. Nothing in scope types the option often enough to want one.
- **A migration guide entry.** Declined. The guide already names `underdot build` and the non-zero exit.
- **Cleaning stale `dist/` output in the build script.** Deferred. It is the follow-up the static build's PR raised, and it is not this plan's.

## Phases

### Phase 1: The seam and the command

1. Create `src/build/run-build.ts` exporting `runBuild` per Decision 1, holding what `src/build/build.ts:15-18` holds today. Head it with a spec marker naming `docs/specs/build.md`. Reduce `build` to resolving and calling `runBuild`. Create `src/build/run-build.test.ts`, headed with the marker its module carries: `runBuild` given `resolveConfiguration({}, directory)` for a copy of `defaults` leaves `build/index.html` in the copy, and given a resolved configuration whose source root is missing rejects with the walk's message. *(deviation: with the pipeline as `build` in `build.ts`, the whole-site tests and the walk's-error test stay in `build.test.ts`, and the two tests of the public signature, resolution and the default project directory, moved to `src/index.test.ts` beside the entry. See Decision 1.)*
2. Create `src/configuration/run-command.ts` exporting `runCommand` per Decisions 2, 3, and 4. Head it with a spec marker naming `docs/specs/configuration.md`, Commands. Put the load, the build, and the failure report in a function of the module's own, `runBuildCommand(configurationPath?: string): Promise<number>`, headed with a marker naming `docs/specs/build.md`, Errors, since that function enforces a different spec from the rest of the file. Write a usage error as `${reason}\n${usage}\n` and a failure as `${message}\n`. The reasons are `No command given.`, `Unknown command: ${name}.`, `Unexpected argument: ${argument}.`, and the parser error's message. *(deviation: the reasons are thrown by `parseCommand`; see Decision 3.)*
3. Create `test/fixtures/throwing-config/underdot.config.js` whose only statement throws the string `The configuration refused to load.`.
4. Create `src/configuration/run-command.test.ts`, headed with the marker its module carries, mocking `process.stderr.write` in each test:
   - `['build']` in a copy of `defaults` returns 0, writes nothing, and leaves `build/index.html` in the copy.
   - `['build', '--config', <path>]` naming the copy's `underdot.config.ts` from the repository's working directory returns 0 and builds the copy, which proves the project directory is the file's.
   - `['build']` with the working directory changed into `no-config`, read in place since nothing is written, returns 1 and writes the loader's message naming both file names and the directory.
   - `['build', '--config', <path>]` naming `ts-config`'s file returns 1 and writes the walk's message naming the missing source root.
   - `['build', '--config', <path>]` naming `throwing-config`'s file returns 1 and writes `The configuration refused to load.`.
   - `[]` returns 2 and writes `No command given.` and the usage line.
   - `['serve']` returns 2 and writes `Unknown command: serve.` and the usage line.
   - `['build', 'extra']` returns 2 and writes `Unexpected argument: extra.` and the usage line.
   - `['build', '--config']` returns 2 and writes the parser's missing-value message and the usage line.
   - `['build', '--foo']` returns 2 and writes a first line starting `Unknown option '--foo'` and the usage line.

   *(deviation: the usage cases are value tests of `parseCommand` in `src/configuration/parse-command.test.ts`, which also proves the three forms `--config` takes. `run-command.test.ts` keeps two usage cases, one of the module's own reasons and one of the parser's, proving the report and the status.)*
5. Run `npm run check`. Coverage reports `run-build.ts` and `run-command.ts` at 100 on every column.

### Phase 2: The executable

1. Create `src/underdot.ts` per Decision 5: the shebang `#!/usr/bin/env node`, a spec marker naming `docs/specs/configuration.md`, Commands, a blank line, the import, and `process.exitCode = await runCommand(process.argv.slice(2));`.
2. Add `"bin": { "underdot": "dist/underdot.js" }` to `package.json`, and `--test-coverage-exclude='src/underdot.ts'` to the test script after the existing exclude. *(deviation: the exclude was not added, since the shim is measured; see Decision 5.)*
3. Add `'n/hashbang': ['error', { convertPath: { 'src/**/*.ts': ['^src/(.+?)\\.ts$', 'dist/$1.js'] } }]` to the rules block at `eslint.config.js:49-53`, with a comment stating that the rule reads `bin` against the compiled path.
4. Create `src/underdot.test.ts`, headed with the marker its module carries, running `process.execPath` on `src/underdot.ts` with `execFile` from `node:child_process`: with `build` in a copy of `defaults` it exits 0 with empty stderr and leaves `build/index.html`, and with no arguments it exits 2 with `No command given.` and the usage line on stderr.
5. Through `/q:update-docs`:
   - Amend `docs/conventions/toolchain.md`, Modules, so the sentence placing `src/index.ts` at the root also places `src/underdot.ts`, the command's entry, and states that an entry exporting nothing is named after what it installs.
   - Amend `docs/conventions/testing.md`, Coverage, to state that a file no test loads is absent from the report rather than reported at zero, so a module without a test escapes the threshold, and that the exclude list is where a file that must not be measured is named. *(deviation: the second statement was not added, since the shim is measured. The section states instead that a spawned process's coverage reaches the report.)*
   - Tick plan 2.3 at `README.md:24` and step 2 at `README.md:21`.
6. Run `npm run check`. Coverage reports every module at 100 on every column, and `underdot.ts` is absent from the report. *(result: every module at 100 on every column, `underdot.ts` present among them.)*

## Verification

- After `npm run build`, from a temporary copy of the `defaults` fixture, run `node <repo>/dist/underdot.js build`. It exits 0, prints nothing, and leaves the six planned files in the copy's `build`. Run `node <repo>/dist/underdot.js` in the same copy. It exits 2 with the usage on stderr. This proves the emitted shim keeps its shebang and that its relative imports, rewritten from `.ts` to `.js` on emit, resolve, which the spawn test never does because it runs the source. *(result: held on Node 24.19.0. The shebang is the emitted file's first line, the build left the six files and nothing else, and the bare run exited 2 with the usage.)*
- `npm pack --dry-run` lists `dist/underdot.js`, and the packed manifest carries the `bin` field. *(result: the dry run lists the file but never prints the manifest, so the `bin` field was read from the manifest inside a tarball packed into a scratch directory. Both held. The driving manual records the two checks.)*
- The CI matrix passes on Node 22.18.0. The parser, the mock, and the spawn were proven on Node 24 only, and the floor's run of the command and shim tests is the proof for the release the package supports. *(result: the whole suite passes on Node 22.18.0 locally, at 100 on every column, with the shim printing nothing to stderr under the floor's type stripping. CI runs on push.)*
