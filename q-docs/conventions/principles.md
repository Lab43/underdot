# Principles

This project's cross-cutting rules, including any deviations from q's (see: @lab43/q conventions/principles.md).

## A page is not its source file

Represent a page as plain data: its output path, its frontmatter, its body, the renderer for that body, and the directory it belongs to. Classification sets the directory, the output path, and the URL from the path alone. The read that follows parses the frontmatter and the body, and the value is complete. Everything after the read works from the value and never reads the source file to learn something the value already holds.

Rationale: a page type built around a file path cannot represent a page that has no file. Plugin-generated pages, such as paginated listings, are out of scope for now, and this keeps them a matter of adding a second producer of page values later rather than reworking rendering and output. Keep the directory as a field set at classification, not something derived from the output path: `about.ejs` and `about/index.ejs` share an output path but belong to different directories (see: q-docs/specs/source-tree.md, A page and a directory may share a name).

## Names state contents or action

Name a value for what it holds, as a noun phrase: `paths`, `sourceFiles`, `outputs`. Never name it for how it was made or for its part in an algorithm, as `resolved`, `classified`, or `ancestors` do. Name a function for what it does, as a verb phrase: `walkSource`, `classifySource`, `removeExcludedFiles`. Never name it as a noun for its result, and never with a verb that reads as acting on the whole input when it acts on part of it: `excludeFiles` read as excluding every file, where `removeExcludedFiles` acts on the excluded ones. A predicate is a question: `isPrivate`. A type is a noun phrase for what its values hold: `SourceFiles`, `StaticFile`. The rule that a module is named after its one function follows from this (see: q-docs/conventions/structure.md, Names).

Name a path for what it is under. `sourcePath` is a file's path under the source root, `outputPath` is its path under the destination, and `url` is the address a link uses, the output path with a leading slash and a trailing `index.html` removed (see: q-docs/specs/source-tree.md, URLs). A bare `path` names none of the three, so no field or variable holding one is called that. `PageFile` in `src/source-tree/classify-source.ts` carries all three. Rationale: `about.tpl`, `about/index.html`, and `/about/` look alike, and a URL is itself a path, so only a name that says which one it is reads without a lookup.

Rationale: a reader meets a name at a call site or a destructuring, far from its definition, and a name that states its contents or its action reads there without a lookup. A name for how the value came to be states what the assignment beside it already shows.

## Linear functions

Write a function so it reads top to bottom. Extract a helper only when a second caller needs it (see: @lab43/q conventions/principles.md, Copying is the signal to extract). A step with one caller stays inline, as a local function inside its caller when it needs a name, as `readFile` and `readBody` in `src/plugins/bind-render-context.ts` do. Rationale: a helper with one caller sends the reader out of the function to learn what one line does and back again, and its name is a summary the reader has to trust. The code read in order needs no summary.

When a linear function enforces two sections, of one spec or of two, each enforcing statement carries its own section's marker, as the two checks in `readFile` and the catch in `runHandlers` do (overrides: @lab43/q conventions/specs.md, Enforcement). Rationale: q marks the head of a unit and never a check so that one fact is not repeated down a block. Two markers naming two sections repeat nothing, and splitting the function to give each section its own head is the extraction the rule above forbids.
