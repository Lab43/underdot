# Configuration

Rules for writing a site's Underdot configuration file.

## Write the configuration in TypeScript

Write the configuration as `underdot.config.ts` rather than `underdot.config.js`. Import the `Configuration` type from `underdot` with `import type`, and mark the default export with `satisfies Configuration`. Rationale: `underdot` publishes the configuration's type, and only a TypeScript file is checked against it in the editor, so a wrong setting or a wrong plugin option fails as you type rather than in a build. A TypeScript file whose default export carries no type is checked against nothing, so the check happens only in that form. `satisfies` checks the literal against the type and rejects an unknown setting while keeping the literal's own type.

Rejected: a helper function that returns its argument typed. The configuration is data and runs nothing, and a call for the sake of a type annotation is a step the keyword already covers.

## Use only syntax the runtime erases

Write the configuration with type annotations and nothing TypeScript would have to rewrite: no enums, no namespaces, and no parameter properties. Import types with `import type`, because a plain import of a type is not erased and fails to load. Rationale: the configuration runs on Node's type stripping with no compile step, and type stripping refuses any syntax it cannot simply drop.
