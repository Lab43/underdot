# Collections

What the collections plugin commits to: the page hook that defines a global per collection, the list of the pages below a directory, and the one helper that reads a page's rendered body into a template. The plugin is a page hook and a helper under the plugin contract (see: docs/specs/plugins.md, Page hooks) (see: docs/specs/plugins.md, Template helpers), and this spec holds what each adds to that contract.

## The plugin

The plugin is named `collections` and registers one page hook and one helper, `pageBody`. Rationale: a collection is a global, which a page hook defines, and a page's body exists only at render time, which a helper reaches and a hook never does.

## Collections

Each collection the site configures defines one global, named by the site (see: Options). Its value is the list of the pages below the directory's URL: every page whose URL starts with `/<directory>/` and is not that URL itself, at any depth. The directory's own page is excluded, whether it is written beside the directory or as `index` inside it (see: docs/specs/source-tree.md, A page and a directory may share a name). Rationale: membership is by URL because the directory's own page can be written two ways, and by source directory one spelling would list itself while the other would not. The URL names both the same way. The directory's own page is the index of the URL space and not one of its children, which is what a section's listing is. Every depth is included because a site that nests its posts by year has nested its posts.

Each item is the page's frontmatter as the hook sees it (see: docs/specs/plugins.md, Page hooks) plus `_url`, the page's URL, and nothing else. Rationale: the frontmatter is what a listing prints, and `_url` is the name every template already knows a page by, which no frontmatter key can collide with (see: docs/specs/templates.md, Reserved keys). The body is not carried because a hook never sees rendered content. A template reads it through the helper (see: pageBody).

The list is in the order the hook receives the pages, the order of their source paths (see: docs/specs/plugins.md, Page hooks). Rationale: the build already sorts the pages, and a sort by a frontmatter key is the template's to choose.

The list and each item's own keys are frozen. Nothing nested below an item's key is, so a date or a list in the frontmatter stays what YAML made it. A template that sorts a collection sorts a copy, as `toSorted` makes, and no render can change what another render sees. Whether a template's attempt to change the list or an item fails or is ignored is the engine's affair. Rationale: a collection is one global shared by every render, and chains render in no defined order (see: docs/specs/build.md, Order of work), so a template that sorted the list in place would reorder it for every template rendered after it, differently on every run.

A directory under which no page is defines an empty list. Rationale: the hook sees pages and nothing else, so it cannot tell a misspelled directory from a section with no pages yet, and a site before its first post has nothing to fix.

## pageBody

A template calls `pageBody(url)`. It returns the rendered body of the page at the URL, before any template of its chain wrapped it (see: docs/specs/templates.md, Rendering the chain). The body is read through the render context, so the helper is callable from a template and never from a page body, and the context's two errors apply: a page body that calls it, and a URL no page has (see: docs/specs/plugins.md, Render context). Rationale: the context already raises both errors naming the file and the URL, so the helper adds nothing to them. The helper takes the URL rather than the item because `_url` is on the item, and a URL from anywhere else, a link in a data file say, reads the same way.

A URL that is not a string is an error.

## Options

The factory takes one object, each key a collection's name, the global it defines, and each value a directory under the source root written without a leading or trailing slash: `collections({ posts: 'posts' })`. A call with no object defines no collection and registers `pageBody` alone. Rationale: a collection is a name and a directory and nothing else, and a site reads the map at a glance.

These are errors, raised when the configuration loads and before any work starts:

- An options value that is not an object, `null` and an array included.
- A directory that is not a string, is empty, or starts or ends with a slash. Rationale: the prefix a collection selects by is built from the directory, and a leading or trailing slash would make a prefix no URL has.

A collection name that starts with an underscore, or that the configuration, a data file, another hook, or a helper already carries, is the build's error, naming the plugin's page hook (see: docs/specs/plugins.md, Page hooks).

The factory takes no other option. Rationale: a sort is `toSorted` over the frozen list, and no site has asked the plugin to vary in any other way.
