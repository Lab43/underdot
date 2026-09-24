# Configuration

Rules for writing a site's Underdot configuration file.

## Write the configuration in TypeScript

Write the configuration as `underdot.config.ts` rather than `underdot.config.js`. Rationale: `underdot` publishes the configuration's type, and only a TypeScript file is checked against it in the editor, so a wrong setting or a wrong plugin option fails as you type rather than in a build.

## Use only syntax the runtime erases

Write the configuration with type annotations and nothing TypeScript would have to rewrite: no enums, no namespaces, and no parameter properties. Import types with `import type`, because a plain import of a type is not erased and fails to load. Rationale: the configuration runs on Node's type stripping with no compile step, and type stripping refuses any syntax it cannot simply drop.
