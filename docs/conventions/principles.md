# Principles

This project's cross-cutting rules, including any deviations from q's (see: @lab43/q conventions/principles.md).

## A page is not its source file

Represent a page as plain data: its output path, its frontmatter, its body, the renderer for that body, and the directory it belongs to. Classification is where a source file becomes one of these values. Everything after classification works from the value and never reads the source file to learn something the value already holds.

Rationale: a page type built around a file path cannot represent a page that has no file. Plugin-generated pages, such as paginated listings, are out of scope for now, and this keeps them a matter of adding a second producer of page values later rather than reworking rendering and output. Keep the directory as a field set at classification, not something derived from the output path: `about.ejs` and `about/index.ejs` share an output path but belong to different directories (see: docs/specs/source-tree.md, A page and a directory may share a name).
