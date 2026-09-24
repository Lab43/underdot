# Testing

Rules for writing and running the tests.

## Coverage

Hold coverage at 100% for lines, branches, and functions on every test run, never only in CI. Rationale: a threshold that runs only in CI is one people meet after the push.

Exclude a line that cannot run under test with a `node:coverage ignore next` comment stating why it cannot, and give the comment a line count when the excluded code spans more than one line. Exclude a whole file only through the test script's exclude list, never with a comment, so every file-level exclusion is visible in one place.
