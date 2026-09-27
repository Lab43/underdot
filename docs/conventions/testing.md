# Testing

Rules for writing and running the tests.

## Coverage

Hold coverage at 100% for statements, lines, branches, and functions on every test run, never only in CI. Rationale: a threshold that runs only in CI is one people meet after the push.

The report covers every file the coverage globs in `vitest.config.ts` include, whether or not a test loads it, so a module without a test fails the threshold at zero. Coverage is collected from the test's own process alone: code that runs only in a process a test spawns counts as unrun, which is why `src/underdot.test.ts` imports the command's shim with the command mocked as well as spawning it.

Reach a branch that only a dependency's failure takes by mocking the dependency with `vi.mock`, as `src/templates/parse-frontmatter.test.ts` does to make `js-yaml` throw. Exclude a statement from coverage only when no test can run it, with a block comment holding nothing but the directive, `/* v8 ignore next */`, directly above it. The directive excludes the whole statement that follows, an `if` with its body included. State why the code cannot run in a line comment directly above the directive. Exclude a whole file only through the config's exclude list, never with a comment, so every file-level exclusion is visible in one place.

## Placement

Put a test in the file of the module whose code does the work it proves. A module that delegates gets tests only for what it adds: its own checks, its defaults, and one test that reaches the delegate end to end. Never prove the delegate's behavior again through the caller. A whole-site test belongs to the module that runs the pipeline, not to the entry that wraps it. When a function is split, its tests move with the work. Rationale: a test filed under a caller proves the delegate through a layer that adds nothing, so the delegate's own file looks untested and the same case gets written there too. A reader with a module open expects its tests to be that module's own.

## Fixtures

Put a test fixture in its own directory under `test/fixtures/<case>/`, one directory per filesystem case. A fixture is a project directory holding what its case needs: a configuration file, a source tree, or deliberately neither. Any test may read any fixture in place, and no test writes one. A test that builds copies its fixture to a temporary directory with `copyFixture` from `test/helpers/copy-fixture.ts`, which removes the copy when the test finishes, and builds the copy. A test proving that a build fails before any write builds the fixture in place, because that build writes nothing. Rationale: every fixture is a project directory, so a subject level between the root and the case named nothing. The test runner runs test files in parallel, each in its own process, so a fixture two of them wrote would race, and a rule allowing one writer per fixture invites the race it warns about. A copy per test has one writer by construction, and nothing under `test/fixtures/` is ever generated, so no ignore entry guards it.

Give a test a fixture only where the code under test touches the disk, or where a whole site proves an integrated build. Test everything else on values: a function from a value to a value gets an object literal, never a file. Rationale: a fixture is a filesystem case, and a rule about a value has no filesystem case to hold.

Import a file from a fixture only in a test that exercises that fixture. A fixture's files belong to its site: its configuration imports its own plugin, and a test that builds or reads the fixture imports its configuration. A test that needs a plugin value for another case writes the plugin as a literal, as the build tests in `src/build/build.test.ts` do. Rationale: a file pulled out of one fixture into a test of another couples two cases that should stand alone, and hides that the second case has no site behind it.

Write the files a fixture holds exactly as a site writes them, in the form the site conventions prescribe, and keep the fixtures inside the typecheck. Rationale: a typechecked fixture configuration is the proof that a site's file checks against the exported type.

Rejected: fixtures beside the test that owns them, in a directory named after the test. A whole-site fixture has several owners, and a fixture under `src/` needs a typecheck exclude, a coverage exclude, and a lint ignore that a root outside `src/` does not.

Rejected: writing fixture files into a temporary directory at test time. A fixture that is a file is what a reviewer can open and a site author can recognize. Only a build's output goes to a temporary directory.

## Helpers

Put a helper two test files need under `test/helpers/`, as a module exporting that one function and named after it, and import it by relative path. Never copy it into each test file, and never put it under `src/`. Rationale: copying is the signal to extract (see: @lab43/q conventions/principles.md, Copying is the signal to extract). A helper under `src/` counts against the coverage threshold and compiles into the package, where `test/helpers/` is inside the typecheck and lint and outside both.
