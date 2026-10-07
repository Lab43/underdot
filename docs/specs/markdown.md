# Markdown

What the Markdown plugin commits to: how a file renders with Markdown, the one helper it registers, and that the plugin takes no options. The plugin is a renderer and a helper under the plugin contract (see: docs/specs/plugins.md, Renderers) (see: docs/specs/plugins.md, Template helpers), and this spec holds what each adds to that contract.

## Rendering

The plugin is named `markdown` and registers a renderer for the `md` extension.

A body renders as GitHub Flavored Markdown, as marked renders it with its defaults:

- Tables, strikethrough, and bare-URL autolinks render.
- Raw HTML passes through as written.
- A heading carries no `id`.
- An email autolink is written as a readable `mailto:` link, never as character references.
- Link and image targets are written as given. Rationale: a relative target resolves in the browser against the page's URL and never against the source file, as a `src` attribute in an EJS page does.

The output is a function of the body and marked's version alone, so every machine produces the same destination (see: docs/specs/build.md, Determinism). A marked upgrade can change it.

A body reads no variable. Markdown has no syntax that prints one, so the renderer contract's rule for a variable no file set has nothing to apply to (see: docs/specs/plugins.md, Renderers). A page that needs a variable or a helper in its body is written in another engine. Rationale: interpolating variables before parsing would make the plugin a second template engine for a need no site has stated.

A Markdown template is a Markdown file whose name starts with an underscore (see: docs/specs/source-tree.md, Classification). Rendering one is an error. Rationale: with no way to place `_content`, a Markdown template would replace every page beneath it with its own body, which is never what an author means. A Markdown template no page's chain reaches is never rendered, so it fails nothing.

## The helper

The plugin registers one helper, `markdown`. A page or template calls `markdown(text)`. It returns the text rendered as the Rendering section renders a body: a block of HTML ending with a newline, or the empty string for an empty text. Rationale: the helper's use is a frontmatter value holding a paragraph or two, which a template prints as markup.

A `text` that is not a string is an error. Rationale: a template calling the helper on a variable a page omits then fails naming the template rather than printing nothing, so a misspelled key is never hidden. A template that means to allow the absence checks for it first, as it would before printing any value.

## Options

The factory takes no options. Rationale: passing options through to marked would commit this spec to whatever each marked option means. Which extension makes a page is a site's choice through the files it writes, so no option renames `md`.
