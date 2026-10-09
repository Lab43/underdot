# Bust

What the bust plugin commits to: the one helper it registers, how a reference to a static file resolves, the link the helper returns, and the options the plugin takes. The plugin is a helper under the plugin contract (see: q-docs/specs/plugins.md, Template helpers), and this spec holds what the helper adds to that contract.

## The helper

The plugin is named `bust` and registers one helper, `bust`. A page or template calls it with a path to a static file's output. It returns that output's absolute URL followed by `?v=` and the first eight hexadecimal characters of the SHA-256 of the file's handled output, the bytes the build writes (see: q-docs/specs/plugins.md, Render context). Rationale: a browser caches a file by its URL, so a link that changes when the served bytes change makes a cached file reload then and not otherwise. The hash is of the handled output and not of the source, so a stylesheet a handler compiles or minifies busts when its compiled form changes. The query string leaves the path alone, so nothing else that names the file changes and no handler runs. Eight characters distinguish every revision one file will have, and a longer string buys a link nothing. The hash is a function of the bytes alone, so every machine produces the same link (see: q-docs/specs/build.md, Determinism).

## References

A reference resolves as a read through the render context does: a relative one against the directory of the file being rendered, and one starting with a slash from the source root (see: q-docs/specs/templates.md, Relative paths). The link returned is always the output's absolute URL, the resolved output path with a leading slash, never the reference as written. Rationale: a browser resolves a relative link against the page's URL and not against the template that wrote it, so a relative reference returned as written would name one place to the build and another to the browser.

Three references are errors:

- A reference that is not a string.
- A reference whose resolved path has a segment starting with an underscore. Rationale: that output is never written (see: q-docs/specs/source-tree.md, Underscore prefix), so no link can reach it.
- A reference at which no static file's output is, a page's path included. Rationale: a link no file answers is an author error, and an unbusted link would hide it until the page was served.

## Options

The factory takes no options. Rationale: the helper hashes whichever output it is asked for, so there is no set of files to select, and an option for the parameter name or the hash length would make the links a site commits vary per site for no need any site has stated.
