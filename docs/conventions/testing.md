# Testing

Rules for writing and running the tests.

## Coverage

Hold coverage at 100% for lines, branches, and functions on every test run, never only in CI. Rationale: a threshold that runs only in CI is one people meet after the push.

Exclude a line that cannot run under test with a `node:coverage ignore next` comment stating why it cannot, and give the comment a line count when the excluded code spans more than one line. Exclude a whole file only through the test script's exclude list, never with a comment, so every file-level exclusion is visible in one place.

## Fixtures

Put a test fixture in its own directory under `test/fixtures/<subject>/`, one directory per filesystem case. Give a test a fixture only where the code under test touches the disk, or where a whole site proves an integrated build. Test everything else on values: a function from a value to a value gets an object literal, never a file. Rationale: a fixture is a filesystem case, and a rule about a value has no filesystem case to hold.

Write the files a fixture holds exactly as a site writes them, in the form the site conventions prescribe, and keep the fixtures inside the typecheck. Rationale: a typechecked fixture configuration is the proof that a site's file checks against the exported type.

Rejected: fixtures beside the test that owns them, in a directory named after the test. A whole-site fixture has several owners, and a fixture under `src/` needs a typecheck exclude, a coverage exclude, and a lint ignore that a root outside `src/` does not.

Rejected: writing fixture files into a temporary directory at test time. A fixture that is a file is what a reviewer can open and a site author can recognize.
