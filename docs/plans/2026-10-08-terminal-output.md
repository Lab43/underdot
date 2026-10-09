---
status: pending
delivery: stacked
---

# Terminal output

## Goal

Make what `underdot build` and `underdot dev` print easy to scan, and let an author see what each build did. Every line Underdot prints today is plain text of one shape, so a failure, a warning, and a finished build look alike in a scrolling session, and nothing shows what an incremental rebuild reran. This plan delivers:

- color on every kind of line, and a symbol on each build result and warning
- a timestamp on every report a dev session prints
- a summary line for every successful build, counting the units it ran and reused
- a `--verbose` mode listing each unit that ran, with the inputs whose change made it rerun, and each file written to or removed from the destination

## Context

### Every line is written where its event happens

- `src/plugins/print-warning.ts:7` writes `<unit> warned in <plugin>: <message>` to stderr. It is called at `src/plugins/run-handlers.ts:78`, `src/plugins/run-page-hooks.ts:60`, `src/plugins/produce-files.ts:123`, and `src/plugins/bind-render-context.ts:226` and `:291`.
- `src/configuration/run-command.ts:20`, `:41`, and `:55` write `describeError(error)` to stderr. The parse failure at `:55` appends the usage from `:12` and returns status 2.
- A successful `underdot build` prints nothing (`src/configuration/run-command.ts:16-23`). Neither does `build` in `src/index.ts:20`, whose signature is `build(configuration, projectDirectory = process.cwd())`. `dev` in `src/index.ts:29` takes `(configuration, options = {}, projectDirectory = process.cwd())`.
- `src/dev-server/start-session.ts` writes a watcher's error at `:130`, a configuration that fails to reload at `:165`, a failed build at `:207`, `Built in <n> ms` at `:217`, `Serving <url>` at `:266`, and `Network <url>` at `:272`. The reload failure at `:165` writes `configurationError`, the string `describeError` made of the error at `:163`. The session binds its first build at `:58` and rebinds after a successful reload at `:178`. A reload runs only when the configuration file's watcher set `reloadPending` at `:254`, and that watcher exists only when `configurationFile` is given.
- A build that settles after the session closed prints nothing: `runBuilds` checks `isClosed()` before the failure report and before the `Built` line.

### Spec sections the output must honor

- docs/specs/plugins.md, Errors: the warning line, and that Underdot adds no warnings of its own.
- docs/specs/build.md, Errors, Incremental builds, and Concurrency.
- docs/specs/dev-server.md, Session, Serving, and Build status.
- docs/specs/configuration.md, Commands, and Programmatic use, which says the exported functions do what the commands do.

### Tests pin today's exact text

- Warning lines are asserted as stderr strings at `src/plugins/handle-files.test.ts:112`, `src/plugins/bind-render-context.test.ts:193`, `:198`, and `:205`, `src/plugins/produce-files.test.ts:130` and `:149`, `src/plugins/run-handlers.test.ts:168`, `src/plugins/run-page-hooks.test.ts:103`, `src/templates/render-pages.test.ts:264`, `src/build/bind-build.test.ts:525`, and in `src/plugins/print-warning.test.ts`. `src/templates/render-pages.test.ts:14` imports `printWarning` and calls it from the stub context at `:49`, and its case at `:268` asserts that a reused render writes two lines to stderr.
- `src/dev-server/start-session.test.ts` matches stdout lines by their start, `Built`, `Serving`, and `Network`, and asserts stderr reports exactly.
- `src/configuration/run-command.test.ts` asserts stderr exactly, and that a successful build writes nothing to stderr.
- `src/underdot.test.ts:47` asserts the shim's build writes nothing to stderr, `:67` finds the URL with `/^Serving (\S+)$/m`, and `:76` asserts the usage error exactly. Its `runShim` at `:18` and its `dev` fixture at `:24` spawn the shim with the test process's environment.
- `src/index.test.ts:48` asserts `stdout[0]` is `Serving <url>`.
- `src/build/bind-build.test.ts` calls `bindBuild(` 24 times.
- `vitest.config.ts` sets `restoreMocks` and no `setupFiles` or `unstubEnvs`.

## Decisions

1. **One reporter carries every line Underdot prints, and the build reports to it rather than printing.** A new `src/build/bind-reporter.ts` exports `bindReporter({ timestamps }: { timestamps: boolean }): Reporter` and declares the `Reporter` interface, with a method for each kind of line Underdot prints today:

   - `serving(url: string, networkUrl: string | undefined)`
   - `reloaded(configurationFile: string)`
   - `warned(unit: string, pluginName: string, message: string)`
   - `failed(report: string)`
   - `built(milliseconds: number)`

   `bindBuild(configuration, reporter)` takes a reporter and hands it to every place a plugin warns, in place of `printWarning`, which is deleted with its test. The command, the session, and `src/index.ts` each make the reporter. Rationale: a session's lines carry timestamps and a command's do not, and a script may run several sessions at once, so how a line looks belongs to whoever started the work, which a module-level printer cannot express. The build then holds no colors and no clock, and its tests assert what it reported rather than text. Rejected: one function taking an event object, `report({ type, ... })`, which types every kind through one union and reads worse at the call site than a method per kind.

2. **Each kind of line has a stream, a symbol, and a color.** `styleText(format, text, { stream })` from `node:util` exists on the Node floor, 22.18.0. With its default stream validation it styles text only when the stream is a terminal, returns plain text when the stream is piped, honors `NO_COLOR`, and styles a stream that is not a terminal when `FORCE_COLOR` is set. It reads the environment on every call, and a format may be a list, as `['bold', 'red']`. Verified by running it on Node 22.18.0 and 24.19.0 piped, on a terminal under `script`, with `NO_COLOR=1`, with `FORCE_COLOR=1`, with `CI=true GITHUB_ACTIONS=true` piped, which stays plain, and with `FORCE_COLOR` set partway through a process.

   Style every line with `styleText` for the stream it is written to:

   - `built` writes `✓ Built in <duration>` to stdout, in green.
   - `failed` writes the report to stderr, its first line prefixed `✗ ` and both in red, and every later line as it is. The caller makes the report with `describeError`, so the session reports the same string to the terminal and to the browser.
   - `warned` writes `! <unit> warned in <plugin>:` in yellow, then a space and the message as it is, to stderr. A message of several lines, as Sass's stack makes, keeps its later lines as they are.
   - `serving` writes `Serving <url>` to stdout, then `Network <networkUrl>` when one is given, each URL in cyan and each line a report of its own.
   - `reloaded` writes `Reloaded <file>` to stdout, naming the file by its base name.

   A duration under one second prints as whole milliseconds, as `84 ms`. Round first: a rounded value of 1000 or more prints as seconds with one decimal, as `1.0 s` and `1.4 s`.

   Write each report in one `write` call on its stream, its later lines included, ending in a newline, so the test capture keeps one entry per report as it does today. `serving` therefore makes two writes when it has a network URL.

   With `timestamps: true`, the first line of each report starts with the local time as `HH:MM:SS`, 24-hour and zero-padded, in dim, followed by a space. Later lines of the same report carry none. Rationale: the author matches a line to a save by the clock they see. The determinism rule governs the destination, not the terminal (see: docs/specs/build.md, Determinism).

   Rationale for the symbols: they tell a success, a failure, and a warning apart where color is off, under `NO_COLOR`, in a CI log, or for a reader who does not see the colors. The other lines are told apart by their first word.

3. **Tests run with color off whatever the developer's environment holds.** Inside a Vitest worker, stdout is not a terminal and `FORCE_COLOR` is unset even when Vitest itself runs on a terminal, verified with a throwaway test run under `vitest run` piped and under `script`. A developer or CI that exports `FORCE_COLOR` would still turn color on in every capture and in every shim the tests spawn. A new Vitest setup file, `test/setup/remove-color-variables.ts`, deletes `FORCE_COLOR` and `NO_COLOR` from `process.env`, and `vitest.config.ts` lists it in `setupFiles` and sets `unstubEnvs: true`. Each test file's process, and every shim it spawns, then starts without either variable, and a test that stubs `FORCE_COLOR` to prove a color has it removed again after that test. It exports nothing, so it is not a helper and sits outside `test/helpers/` (see: docs/conventions/testing.md, Helpers). Rejected: stripping escape codes in the capture, which would hide the codes from the tests that assert them.

4. **A successful build prints its summary line.** A new `src/build/run-build.ts` exports `runBuild(configuration: ResolvedConfiguration, reporter: Reporter): Promise<void>`. It binds the build, runs it once, and calls `reporter.built` with the milliseconds from `performance.now()` before the bind to after the run. `runBuildCommand` and `build` in `src/index.ts` call it. A failure throws past it. The command reports a failure with `reporter.failed` and returns 1. `build()` rejects as it does today and prints no report. Rationale: a rejection carrying the report is the function's form of the command's exit status and printed report, so the script that called it decides whether and how to show the error, and printing it as well would show it twice in a script that logs what it catches.

5. **The session prints every line through one reporter with timestamps.** `startSession` makes `bindReporter({ timestamps: true })` once, before its first bind. Replace each write Context lists for `src/dev-server/start-session.ts` with the matching method, the watcher's error at `:130` included, which is a failure and goes through `reporter.failed`, and pass the reporter to both `bindBuild` calls. The reload failure passes `configurationError` to `reporter.failed`, and every other failure passes `describeError(error)`. A reload that succeeds calls `reporter.reloaded(configurationFile)` before its build runs, so the full rebuild that follows reads with its cause. A configuration that fails to load at start throws out of `startSession` as today and is reported by the command.

6. **The command prints every line through a reporter without timestamps.** `runCommand` makes `bindReporter({ timestamps: false })`. A parse failure is reported as `reporter.failed(`${describeError(error)}\n${usage}`)`, so the usage follows the red first line as plain lines, and the status stays 2. The build command's and the dev command's failures are reported as `reporter.failed(describeError(error))`.

7. **`reuseUnit` reports each unit as reused or ran, with the inputs that changed.** Every unit whose result a later build can reuse goes through `reuseUnit` in `src/build/reuse-unit.ts:45`. It returns the recorded result when every recorded input's version equals what `lookup` returns now, and otherwise runs the unit and records what it observed. A run that throws leaves no record. The input kinds are `file`, `output`, `body`, `global`, `globals`, `chain`, `pages`, and `parameters` (`src/build/reuse-unit.ts:8`). The names of `globals`, `pages`, and `parameters` are always the empty string, and their versions are never undefined. It is called at seven sites:

   - `src/templates/read-data.ts:67`, a data file, keyed by its source path
   - `src/build/read-site.ts:53`, a page or template read and its frontmatter parsed, keyed by its source path
   - `src/plugins/handle-files.ts:65`, a static file through its handlers, keyed by its source path
   - `src/plugins/run-page-hooks.ts:78`, one plugin's page hook, keyed by the plugin's name
   - `src/templates/render-pages.ts:155`, a page's body render, keyed by the page's source path
   - `src/templates/render-pages.ts:164`, a page's chain render, keyed by the page's source path
   - `src/plugins/produce-files.ts:148`, an emitted file's producer, keyed by its output path, whose record is deleted at `:100` when its produced file is no longer whole in the destination

   `Reporter` gains `reused(unit: string)` and `ran(unit: string, changes: ChangedInput[])`. `reuseUnit`'s signature becomes `reuseUnit(records, key, lookup, run, reporter, unit)`, where `unit` is the unit's label. A reused unit calls `reporter.reused(unit)`. A unit that runs calls `reporter.ran(unit, changes)` once its run resolves. `changes` lists every recorded input whose version differs from `lookup`'s, as `ChangedInput { kind: InputKind; name: string; status: 'added' | 'removed' | 'changed' }`, declared in `src/build/reuse-unit.ts`. The status is `added` when the recorded version was undefined, `removed` when the current one is, and `changed` otherwise. A unit with no record reports an empty list. A run that throws reports nothing, because the failure is reported instead.

   The labels, in the past tense of the units errors already name:

   - `Read <sourcePath>` for a data file and for a page or template
   - `Handled <sourcePath>` for a static file
   - `Ran the page hook of <pluginName>` for a hook
   - `Rendered the body of <sourcePath>` for a body render
   - `Rendered <sourcePath>` for a chain render
   - `Produced <outputPath>` for a producer

   Rationale for the empty list: a unit with no record is new, or failed last time, or on the first build has never run, and none has a changed input to name. A producer whose file went missing from the destination has its record deleted before `reuseUnit` sees it, so it reports the same way. Rejected: a reason of its own for each of those cases, which would need `reuseUnit` to tell them apart for a line that adds nothing the unit's label does not already say.

8. **The build counts its units and returns the counts.** The function `bindBuild` returns resolves to `BuildCounts`, `{ ran: number; reused: number }`, declared in `src/build/bind-build.ts`. Each run wraps the reporter it hands down so that `ran` and `reused` add one to that run's counts and then forward to the reporter. `built` takes the counts as a second parameter and prints them after the duration, in dim: `✓ Built in 84 ms · 3 ran, 417 reused`. The `reused` part is left out when it is zero, so `underdot build`, which reuses nothing, prints `✓ Built in 1.4 s · 420 ran`. `runBuild` and the session pass the counts. Rationale: counts held by the run cannot be skewed by a failed build before them or by a report between builds, and the reporter keeps no state. Only units count. Rationale: a unit that reran to the same bytes changes nothing in the destination, so a count of files would hide the rerun.

9. **Writes to and removals from the destination are reported.** `writeDestination` in `src/build/write-destination.ts` removes every entry the build did not plan at `:72`, a directory included, and writes a file at `:116`. It writes nothing for a file already in place with the hash last written there. `Reporter` gains `wrote(outputPath: string)` and `removed(path: string)`. `writeDestination` takes the reporter, calls `reporter.wrote(outputPath)` after each write, and calls `reporter.removed(path)` after each removal, with a trailing slash on the path when the removed entry was a directory. A file left in place reports nothing.

10. **The verbose mode prints the unit and destination reports, and is silent otherwise.** `bindReporter`'s options gain `verbose: boolean`. With `verbose: true`:

    - `ran` writes two spaces and the label to stdout, then, when `changes` is not empty, ` · ` and the reasons joined by `, `, both in dim.
    - `wrote` writes `  Wrote <outputPath>` to stdout.
    - `removed` writes `  Removed <path>` to stdout.

    With `verbose: false`, those three print nothing. `reused` never prints. Under timestamps, each of these lines carries one as Decision 2 says. A reason reads by its kind:

    - `file`: `<name> <status>`
    - `output`: `output <name> <status>`
    - `body`: `body of <name> <status>`
    - `global`: `global <name> <status>`
    - `globals`: `globals changed`
    - `chain`: `template chain changed`
    - `pages`: `pages changed`
    - `parameters`: `parameters changed`

    Lines print as units finish, so their order within a phase varies (see: docs/specs/build.md, Concurrency). A build still running when its session closes may go on listing units. The closed checks keep guarding the `Built` line, the failure report, and the broadcasts. Rationale: listing reused units would print hundreds of lines per save, and their count on the `Built` line says what the author needs.

11. **`--verbose` is a per-run option of both commands and both exported functions.** `parseCommand` accepts `--verbose` as a boolean for `build` and `dev`, and `Command` gains `verbose: boolean` on both variants. The usage becomes `underdot build [--config <path>] [--verbose]` and `underdot dev [--config <path>] [--port <n>] [--https] [--verbose]`. `build` in `src/index.ts` becomes `build(configuration, options: { verbose?: boolean } = {}, projectDirectory = process.cwd())`, matching `dev`. `dev`'s options and `SessionOptions` gain `verbose?: boolean`. Rationale: how much to print is a fact about this run, as the port is, so it stays out of the configuration (see: docs/specs/configuration.md, Commands). The change to `build`'s signature breaks no one, because nothing is published. The functions then take every option the commands do, so docs/specs/configuration.md, Programmatic use, holds unchanged.

12. **Two stacked PRs.** PR 1 restyles every line Underdot already prints, Decisions 1 to 6, in five phases: the reporter lands unused, then the plugin warnings, the build command, and the session each switch to it in a phase of their own, with `printWarning` deleted once nothing calls it. PR 2 adds the unit reports, the counts, and the switch that shows them, Decisions 7 to 11. Rationale: the restyle and the new reporting are each a scope a reviewer holds in one sitting, and together they are not.

## Out of scope

- **Listing reused units.** Declined (see: Decision 10).
- **Printing nothing for a build that reran nothing.** Declined. The `Built` line shows it as `0 ran`.
- **Listing the files left in place in the destination.** Declined. A file left in place is what an unchanged unit already implies.
- **A reason for a unit with no record.** Declined (see: Decision 7).
- **Showing warnings in the browser.** Declined by the spec (see: docs/specs/dev-server.md, Build status).

## Phases

### PR 1

#### Phase 1: The reporter

1. Create `src/build/bind-reporter.ts` per Decisions 1 and 2. It enforces no spec section yet, so it carries no spec marker.
2. Create `test/setup/remove-color-variables.ts` and change `vitest.config.ts` per Decision 3.
3. Create `src/build/bind-reporter.test.ts`. Cases, with timestamps off unless named:
   - each method writes its text to its stream, in one write
   - `serving` with a network URL makes two writes, and without one makes one
   - `failed` with a two-line report prefixes the first line only
   - `warned` with a two-line message keeps the second line as it is
   - durations: 84 prints `84 ms`, 999.4 prints `999 ms`, 999.6 prints `1.0 s`, 1449 prints `1.4 s`
   - with timestamps, under `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime(new Date(2026, 9, 8, 9, 5, 3))`, a report's first line starts `09:05:03 ` and its second line does not
   - under `vi.stubEnv('FORCE_COLOR', '1')`, each kind carries its color's escape codes, asserted as literal strings
4. Create `test/helpers/make-reporter.ts`, exporting `makeReporter(): Reporter` with every method a `vi.fn()`.

#### Phase 2: Plugin warnings through the reporter

1. In `src/build/bind-build.ts`, give `bindBuild` a second parameter, `reporter: Reporter`, and pass it to `bindRenderContext`, `handleFiles`, `runPageHooks`, and `produceFiles`. Its three callers, `src/configuration/run-command.ts:17`, `src/index.ts:21`, and `src/dev-server/start-session.ts` at `:58` and `:178`, pass `bindReporter({ timestamps: false })`.
2. In `src/plugins/bind-render-context.ts`, give `bindRenderContext` a last parameter, `reporter`, and call `reporter.warned` at `:226` and `:291`.
3. In `src/plugins/run-handlers.ts`, give `runHandlers` a last parameter, `reporter`, and call `reporter.warned` at `:78`. Pass it from `handleFiles` in `src/plugins/handle-files.ts` and from `produceFiles`, each of which gains a last parameter, `reporter`.
4. In `src/plugins/run-page-hooks.ts`, give `runPageHooks` a last parameter, `reporter`, and call `reporter.warned` at `:60`.
5. In `src/plugins/produce-files.ts`, call `reporter.warned` at `:123`.
6. Update the tests Context lists for warning lines. In each, pass `makeReporter()` to every call of a function that now takes a reporter, and assert `reporter.warned` was called with the unit, the plugin, and the message in place of the stderr string. In `src/templates/render-pages.test.ts`, replace the `printWarning` import at `:14` and the stub context's call at `:49` with a `warned` call on a reporter the test makes, and assert the case at `:268` through that reporter's calls. Pass `makeReporter()` to every `bindBuild` call in `src/build/bind-build.test.ts`.
7. In docs/specs/plugins.md, Errors, make the warning line `! <unit> warned in <plugin>: <message>`, and head `warned` in `src/build/bind-reporter.ts` with `// spec: docs/specs/plugins.md, Errors`.

#### Phase 3: Retire printWarning

1. Delete `src/plugins/print-warning.ts` and `src/plugins/print-warning.test.ts`, which nothing imports after Phase 2.

#### Phase 4: The build command's lines

1. Add a section, Output, to docs/specs/build.md after Errors. State that a successful build prints `✓ Built in <duration>` on standard output, that a failure prints its report on standard error with `✗` before it, that colors appear on a terminal only and never under `NO_COLOR`, and the rationale for the symbols from Decision 2. Point to plugins.md, Errors, for the warning line rather than restating it. Head `src/build/bind-reporter.ts` with `// spec: docs/specs/build.md, Output`.
2. Create `src/build/run-build.ts` per Decision 4, headed with `// spec: docs/specs/build.md, Output`, and `src/build/run-build.test.ts` with two cases on the `defaults` fixture: a build calls `reporter.built` once with a number, and a failing build rejects and calls nothing on the reporter.
3. In `src/configuration/run-command.ts`, make the reporter per Decision 6, run the build command through `runBuild`, and report every failure through `reporter.failed`. In `src/configuration/run-command.test.ts`, expect `✗ ` before each stderr report, and expect a successful build's stdout to match `/^✓ Built in \d+(?: ms|\.\d s)\n$/`.
4. In `src/index.ts`, make `build` call `runBuild` with `bindReporter({ timestamps: false })`. In `src/index.test.ts`, assert a successful `build` prints the `✓ Built` line.
5. In `src/underdot.test.ts`, expect `✗ ` before the usage error at `:76`, and expect the build's stdout to hold the `✓ Built` line.
6. In docs/guides/driving-manual.md, The compiled command, replace "A successful build prints nothing and exits 0" with the `✓ Built in <duration>` line and exit 0.

#### Phase 5: The session's lines

1. In docs/specs/dev-server.md, add a section, Terminal, after Build status. State that the first line of every report the session prints starts with the local time, that a successful reload prints `Reloaded <file>`, and that each successful build prints the `Built` line. In `src/build/bind-reporter.ts`, mark the statements for `serving`, `reloaded`, and the timestamp with `// spec: docs/specs/dev-server.md, Terminal` (see: docs/conventions/principles.md, Linear functions).
2. In `src/dev-server/start-session.ts`, make the reporter per Decision 5, pass it to `bindBuild` at `:58` and `:178`, replace the writes at `:130`, `:165`, `:207`, `:217`, `:266`, and `:272`, and call `reporter.reloaded(configurationFile)` after a successful reload in `runBuilds`.
3. In `src/dev-server/start-session.test.ts`, add a local function that removes the leading `HH:MM:SS ` from each captured write, and match the lines through it: `✓ Built`, `Serving`, `Network`, and `✗ ` before each report. Add a case that a configuration edit prints `Reloaded underdot.config.ts`, and one that the first line starts with a time matching `/^\d\d:\d\d:\d\d /`. In `src/index.test.ts:48`, match `Serving <url>` after the time. In `src/underdot.test.ts`, find the URL with `/Serving (\S+)$/m`.
4. In docs/guides/driving-manual.md, The dev server, write every `Built in` line as `✓ Built in`, show the session's lines with their leading time, and add the `Reloaded underdot.config.ts` line to the paragraph on editing the configuration.

### PR 2

#### Phase 6: Unit reports and counts

1. In `src/build/reuse-unit.ts`, declare `ChangedInput` and change `reuseUnit` per Decision 7. In `src/build/reuse-unit.test.ts`, pass `makeReporter()` and a label to every call, and add cases:
   - a reused unit calls `reused` with its label and not `ran`
   - a unit with no record calls `ran` with its label and an empty list
   - a changed, an added, and a removed input each report their status
   - a run that throws calls neither
2. Add `ran`, `reused`, `wrote`, and `removed` to `Reporter`, and the counts parameter to `built`, per Decisions 7 to 10. Add them to `makeReporter`. In `src/build/bind-reporter.test.ts`, add cases:
   - the `Built` line with both counts, and with `reused` at zero
   - with `verbose: false`, `ran`, `wrote`, and `removed` print nothing
   - with `verbose: true`, `ran` without changes, `ran` with each kind's reason, two reasons joined, `wrote`, and `removed`
   - `reused` prints nothing with `verbose: true`
3. In `src/build/bind-build.ts`, declare `BuildCounts`, wrap the reporter per Decision 8, return the counts, and pass the wrapped reporter to `readData`, `readSite`, `renderPages`, and `writeDestination` as a last parameter, and to the modules Phase 2 already passes it to. Every `bindReporter` call passes `verbose: false`.
4. Pass the reporter and the label from Decision 7 at each `reuseUnit` call site Decision 7 lists. In `src/templates/read-data.test.ts`, `src/build/read-site.test.ts`, and `src/templates/render-pages.test.ts`, pass `makeReporter()` to every call of `readData`, `readSite`, and `renderPages`. In each of the seven call sites' modules' tests, add one case asserting the label a run reports.
5. In `src/build/write-destination.ts`, report per Decision 9. In `src/build/write-destination.test.ts`, pass `makeReporter()` to every call, and assert a write reports `wrote`, a file left in place reports nothing, and a removed file and a removed directory each report `removed`, the directory with its trailing slash.
6. In `src/build/run-build.ts` and `src/dev-server/start-session.ts`, pass the counts to `reporter.built`. Update `src/build/run-build.test.ts` to assert the counts.
7. In `src/build/bind-build.test.ts`, add a session case on the `templated` fixture: the first build reports no reused units. After the body of a page no other page reads is edited, its frontmatter left as it is, the second build reruns that page's read, body, and chain, reports the edited file as `changed` among each one's changes, reruns no other page's units, reuses the page hook because the pages it sees are unchanged, and returns counts whose sum equals the first build's `ran`.
8. In `src/configuration/run-command.test.ts`, expect the build's stdout to match `/^✓ Built in \d+(?: ms|\.\d s) · \d+ ran\n$/`.
9. In docs/specs/build.md, Output, add the counts on the `Built` line and what they count: units that ran and units reused, with the reused count left out at zero.
10. In docs/guides/driving-manual.md, The dev server, say that when one save prints several `Built` lines, the lines after the first read `0 ran`.

#### Phase 7: The verbose switch

1. In `src/configuration/parse-command.ts`, add `verbose` per Decision 11. In `src/configuration/parse-command.test.ts`, assert `verbose` is false by default and true with the flag, for both commands.
2. In `src/configuration/run-command.ts`, pass the command's `verbose` to the build command's reporter and to `startSession`, and update the usage. In `src/configuration/run-command.test.ts`, assert `build --verbose` prints a `  Handled` line before the `Built` line, and update the usage string.
3. In `src/dev-server/start-session.ts`, take `verbose` from `SessionOptions` into the session's reporter. In `src/dev-server/start-session.test.ts`, add a case: with `verbose: true`, an edited file prints the unit lines naming it before the next `Built` line.
4. In `src/index.ts`, change `build` and `dev` per Decision 11. In `src/index.test.ts`, assert `build` with `{ verbose: true }` prints a `  Handled` line, and update the calls that pass a project directory.
5. In `src/underdot.test.ts`, update the usage string.
6. In docs/specs/build.md, Output, state what the verbose mode lists: each unit that ran with the inputs whose change made it rerun, and each file written to or removed from the destination, with reused units counted and not listed. In docs/specs/configuration.md, Commands, state that both commands accept a verbose option.
7. In docs/guides/driving-manual.md, The dev server, replace both ways the paragraph gives to prove a save reran nothing, a plugin whose handler appends each path it receives to a file and the PostCSS plugin that appends `result.opts.from`, with running the session with `--verbose` and reading the unit lines after the save.

## Verification

Drive the compiled command on a scratch copy of `test/fixtures/templated` per the driving manual, The compiled command, on a terminal:

1. `underdot build` prints one green `✓ Built in <duration> · <n> ran` line and exits 0.
2. `underdot build --verbose` lists a `Read`, `Handled`, `Rendered the body of`, and `Rendered` line for the fixture's files, then a `Wrote` line for each file in the destination, then the `Built` line.
3. `underdot build | cat` prints the same text with no escape codes, and `NO_COLOR=1 underdot build` on the terminal prints no color.
4. A page broken mid-frontmatter prints a red `✗` report on stderr and exits 1.
5. `underdot dev --verbose` prints timestamped `Serving`, `Network`, and `Built` lines. Saving one page prints that page's unit lines, each with `· <page> changed`, a `Wrote` line for its output, and a first `Built` line whose `ran` count matches the unit lines. Any further `Built` lines from the same save read `0 ran`. Saving it again unchanged prints only `Built` lines reading `0 ran`. Editing `underdot.config.ts` prints `Reloaded underdot.config.ts` and a `Built` line with no `reused` part.
