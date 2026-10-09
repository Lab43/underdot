# SVGO

What the SVGO plugin commits to: the file handler that optimizes every SVG, the one helper that inlines an optimized SVG into a page, and the one option the plugin takes. The plugin is a handler and a helper under the plugin contract (see: q-docs/specs/plugins.md, File handlers) (see: q-docs/specs/plugins.md, Template helpers), and this spec holds what each adds to that contract.

## The handler

The plugin is named `svgo` and registers a file handler for `**/*.svg`. Every static file at such a path, a private one included, is optimized with svgo and left at its own path, with svgo's output as it is and nothing appended. Rationale: an optimized SVG is the same file smaller, so leaving it at its path keeps every link and every helper reference working, and svgo's own command writes no trailing newline, so a byte the optimizer did not produce is a byte the site did not ask for. The glob is fixed, because an SVG a site wants left unoptimized is a need no site has stated.

The handler hands svgo the file's output path. Rationale: a parser error then names the file and the line, which is the engine's report the plugin contract passes through (see: q-docs/specs/plugins.md, Errors), and a plugin keyed on the path, such as `prefixIds`, derives its prefix from the file's name alone, the same on every machine.

The output is a function of the file's bytes and the plugin list alone, so every machine produces the same destination (see: q-docs/specs/build.md, Determinism). The handler keeps no table of what it optimized. The helper reads the handled output through the render context, so the build sees the dependency (see: q-docs/specs/plugins.md, Dependencies).

## The helper

The plugin registers one helper, `inlineSvg`. A page or template calls `inlineSvg(reference)`. It returns the optimized SVG at the reference as text. The reference resolves as a read through the render context does (see: q-docs/specs/templates.md, Relative paths): a relative one against the directory of the file being rendered, and one starting with a slash from the source root. A private output is inlined like any other. Rationale: the handler ran before any page rendered and left its output at the file's own path, so the handled output is the optimized SVG, and a site keeps its inlined icons under an underscore directory so the raw files are never written (see: q-docs/specs/source-tree.md, Underscore prefix).

The helper checks no extension. Whatever output the reference names is inlined. Rationale: every SVG is left at its own path, so an output at a `.svg` path is optimized, and a reference to anything else is the author's deliberate act.

These calls are errors:

- A reference that is not a string.
- A reference at which no static file's output is, a page's path included. Rationale: a page with a hole where an icon was is a failure the build should stop for, and nothing printed would hide it until someone looked at the page.

A reference that resolves above the source root fails by the context's rule (see: q-docs/specs/plugins.md, Render context).

## Options

The factory takes one option, `plugins`, svgo's plugin list. A list given replaces the default rather than extending it. Rationale: the plugin list is the one setting that changes what an SVG becomes, and a site that cannot change it cannot keep a `<desc>` the preset drops or turn inline styles back on. The default is this list:

```ts
[{ name: 'preset-default', params: { overrides: { inlineStyles: false } } }, 'prefixIds']
```

Rationale: every site built on v1 configured svgo this way. With `inlineStyles` off, an SVG's `<style>` stays a stylesheet, so a rule in the page's CSS overrides it by the cascade, where an inlined `style` attribute would need `!important`. `prefixIds` prefixes the ids and class names with the file's name, so one inlined SVG's styles and references never reach another's on the same page. The preset keeps `viewBox` and `<title>` on its own, so a v1 configuration's `removeViewBox: false` and `removeTitle: false` have no counterpart.

The list is typed as svgo's own, so a site's configuration is checked against the names and parameters svgo accepts. These are errors, raised when the configuration loads and before any file is handled:

- A `plugins` value that is not an array.
- An entry that is neither a plugin name nor an object with a `name`. Rationale: svgo answers a number with a message naming nothing and `null` with a warning the build never sees.
- A name svgo does not know, with svgo's own message. Rationale: svgo checks the names on the first optimization, which a site with no SVG would never reach, so the plugin optimizes once at setup.

svgo runs with `multipass` on. Rationale: a second pass only finds what the first left, the output is still a function of the file and the list, and a site has no reason to ask for less. The factory takes no other option. Rationale: `path` is the build's, `datauri` would make the output something the helper cannot inline, and every other svgo option is a lever no site has asked for.
