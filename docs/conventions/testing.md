# Testing

Rules for writing and running the tests.

## Coverage

Hold coverage at 100% for lines, branches, and functions on every test run, never only in CI. Rationale: a threshold that runs only in CI is one people meet after the push.

Exclude a line that cannot run under test with a `node:coverage ignore next` comment stating why it cannot, and give the comment a line count when the excluded code spans more than one line. Exclude a whole file only through the test script's exclude list, never with a comment, so every file-level exclusion is visible in one place.

## Fixtures

Put a test fixture in its own directory under `test/fixtures/<case>/`, one directory per filesystem case. A fixture is a project directory holding what its case needs: a configuration file, a source tree, or deliberately neither. Any test may read any fixture in place, and no test writes one. A test that builds copies its fixture to a temporary directory with `copyFixture` from `test/helpers/copy-fixture.ts`, which removes the copy after the test, and builds the copy. Rationale: every fixture is a project directory, so a subject level between the root and the case named nothing. The test runner runs every test file in its own process at once, so a fixture two of them wrote would race, and a rule allowing one writer per fixture invites the race it warns about. A copy per test has one writer by construction, and nothing under `test/fixtures/` is ever generated, so no ignore entry guards it.

Give a test a fixture only where the code under test touches the disk, or where a whole site proves an integrated build. Test everything else on values: a function from a value to a value gets an object literal, never a file. Rationale: a fixture is a filesystem case, and a rule about a value has no filesystem case to hold.

Write the files a fixture holds exactly as a site writes them, in the form the site conventions prescribe, and keep the fixtures inside the typecheck. Rationale: a typechecked fixture configuration is the proof that a site's file checks against the exported type.

Rejected: fixtures beside the test that owns them, in a directory named after the test. A whole-site fixture has several owners, and a fixture under `src/` needs a typecheck exclude, a coverage exclude, and a lint ignore that a root outside `src/` does not.

Rejected: writing fixture files into a temporary directory at test time. A fixture that is a file is what a reviewer can open and a site author can recognize. Only a build's output goes to a temporary directory.

## Helpers

Put a helper two test files need under `test/helpers/`, as a module exporting that one function and named after it, and import it by relative path. Never copy it into each test file, and never put it under `src/`. Rationale: copying is the signal to extract (see: @lab43/q conventions/principles.md, Copying is the signal to extract). A helper under `src/` counts against the coverage threshold and compiles into the package, where `test/helpers/` is inside the typecheck and lint and outside both.
