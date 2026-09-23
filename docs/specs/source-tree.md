# Source tree

What Underdot makes of a site's source directory: which files are pages, templates, and static files, where each lands in the destination, and what URL a page gets. Template inheritance and the plugin contract build on the classification here (see: docs/specs/templates.md) (see: docs/specs/plugins.md).

## Classification

Every file under the source directory is exactly one of three things:

- A **page**: a file whose extension has a registered renderer and whose name does not start with an underscore.
- A **template**: a file whose extension has a registered renderer and whose name starts with an underscore.
- A **static file**: any other file.

Classification is by path alone. A file's contents never change what it is. Renderers are registered by plugins (see: docs/specs/plugins.md, Renderers), so which extensions make a page is the site's choice. A file the configuration excludes is not classified at all (see: docs/specs/configuration.md, Excluded files).

## Underscore prefix

A file or directory whose name starts with an underscore is private to the build:

- It is never written to the destination.
- Files inside an underscore-prefixed directory are not classified. They are neither pages, templates, nor static files.
- An underscore-prefixed static file still passes through file handlers (see: docs/specs/plugins.md, File handlers). Rationale: a site keeps SVGs and Sass partials under the prefix so a plugin can inline or import them without the raw file reaching the output.
- Renderers and plugins may read any file under the source directory, underscore-prefixed or not, including files inside underscore-prefixed directories. Rationale: template includes live in `_includes`.

## Dotfiles

A file whose name starts with a dot is classified like any other file. Rationale: a site ships its `.htaccess` from source.

## Output paths

- A page at `<dir>/<name>.<ext>` is written to `<dir>/<name>/index.html`. When `<name>` is `index`, it is written to `<dir>/index.html`. Rationale: a directory holding `index.html` is the one layout every static host serves at a clean URL with no server configuration, and `index` names a directory's own page.
- A page named `404` at the source root is written to `404.html`, not `404/index.html`. Rationale: static hosts serve the root `404.html` for a missing page, and a site whose not-found page silently landed elsewhere would find out from its visitors.
- A static file is written at its source path, unless a file handler renames it (see: docs/specs/plugins.md, File handlers).
- A template is never written.

## URLs

Every page has a `url`: its output path relative to the destination, with a leading slash and a trailing `index.html` removed. The home page's URL is `/`, a page written to `about/index.html` has the URL `/about/`, and a page written to `404.html` has the URL `/404.html`. The URL identifies the page everywhere: as the `_url` variable, in helpers, and in the page tree plugins see (see: docs/specs/templates.md, Built-in variables). Rationale: the URL is what a template links to and what a helper compares against, so the page's identity is spelled the way a link is.

## Output paths are unique

Two sources that would write the same destination path are a build error that names both sources. This covers two pages with one URL, such as `about.ejs` beside `about/index.ejs` or `about.ejs` beside `about.md`, and a static file colliding with a file handler's renamed output. Rationale: silently keeping one of them makes the output depend on traversal order.

## A page and a directory may share a name

A page `about.ejs` and a directory `about/` coexist. The page is the index of that URL space, and pages inside `about/` are its children. Rationale: a section landing page and its sub-pages are the common shape of a marketing site.

A directory's own page can be written either way: `about.ejs` beside the directory, or `about/index.ejs` inside it. Both produce `about/index.html` with the URL `/about/`, so writing both is a collision (see: Output paths are unique). They differ in membership. `about.ejs` belongs to the parent directory and `about/index.ejs` belongs to `about/`, and membership decides which templates apply to the page and which directory its relative paths resolve against (see: docs/specs/templates.md, Template resolution). A template in `about/` therefore applies to `about/index.ejs` and to the children, and never to `about.ejs`.
