# Templates

How a page becomes a finished document: the frontmatter a page or template carries, how a page finds its template chain, and which variables every file in the chain sees. Which files are pages and templates is the source tree's call (see: docs/specs/source-tree.md, Classification). A site with no registered renderer has no pages and no templates, and nothing here applies to it.

## Frontmatter

A page or template may open with a YAML frontmatter block, delimited by a line of three hyphens before and after. Everything after the block is the file's body. A file with no block has an empty set of frontmatter keys and its whole contents as its body. Static files have no frontmatter. Rationale: a title, a body class, or a template choice is a fact about the file, and frontmatter is the one place a file states such facts.

A frontmatter key becomes a variable of the same name (see: Variables), except the reserved keys below. Values keep the types YAML gives them, so an unquoted date is a date value and not a string. Rationale: a listing sorts and formats posts by date, and a string would need every template to parse it.

## Reserved keys

One frontmatter key is a directive rather than a variable. `template` names the file's parent template (see: Template resolution). A directive is read from the file's own frontmatter only, never from the merged variables, so a page's `template` cannot redirect its template's parent.

Frontmatter keys starting with an underscore are reserved for the built-in variables (see: Built-in variables). A frontmatter key starting with an underscore is a build error naming the file. Rationale: reserving the class rather than a list lets a built-in be added later without breaking any site, and a silently shadowed built-in makes a link or an active-state check wrong on one page only, which is the hardest kind of bug to find.

## Template resolution

Every page renders through a chain of templates that ends at a root template. Each file in the chain names its parent in one of two ways:

- **No `template` key**: the parent is the nearest template named `_`, searching the file's own directory first and then each parent directory up to the source root. A template named `_` searches strictly above its own directory, because it cannot be its own parent.
- **`template: <name>`**: the parent is the nearest template named `_<name>`, searching the file's own directory first and then upward. The value is the name with no underscore prefix and no extension. Rationale: a section can specialize a site-wide template by defining one of the same name in its own directory. A page in `blog/` that asks for `post` gets `blog/_post` when the section defines one, and the site's `_post` otherwise, without changing what it asks for.

The chain ends at the first template whose default search finds nothing above it. That template is a root template. The source root's `_` is the usual root but is not required: a `_` template with no `_` above it is a root wherever it sits, so a site may have several roots or none at the source root. Rationale: a section can be fully self-contained, and a page that needed a root the site lacks is caught by the error below.

The directory a file searches from is the directory it belongs to (see: docs/specs/source-tree.md, A page and a directory may share a name).

Two failures are build errors that name the file and the template it asked for:

- A page whose default search finds no `_` template at all. Rationale: a page landing in the output unwrapped is never what a missing template means.
- A `template: <name>` that no directory on the search path satisfies.

Two templates in one directory with the same name and different extensions are a build error naming both. Rationale: `_fancy.ejs` beside `_fancy.md` leaves the search with no rule to pick by.

## Rendering the chain

A page's body renders first, with the renderer registered for its extension (see: docs/specs/plugins.md, Renderers). Its output becomes `_content` for its parent template, whose output becomes `_content` for the next parent, up to the root. Each file renders with the renderer for its own extension, so a Markdown page renders inside an EJS template.

## Variables

Frontmatter carries two kinds of value, and every file in the chain gets a view suited to each.

**Page attributes** mean the same thing at every level of the chain: a title, a body class, a color scheme. A template supplies a default and the page overrides it. They reach every file as one merged set of variables, built in this order, each layer overriding the keys of the layers before it:

1. The site's globals, from the configuration (see: docs/specs/configuration.md, Globals) and from data files (see: Data files).
2. Each template's frontmatter, from the root template down to the template nearest the page.
3. The page's frontmatter.

The built-in variables (see: Built-in variables) are added to the set and can collide with nothing, because their names are reserved. Only frontmatter flows between files: a value a body computes while rendering is local to that render and reaches no other file in the chain. Rationale: a template nearer the page knows more about it than one further away, and the page knows most. The whole chain sees the same set, so a root template can read a body class that a section template set, and the page can override both.

**Template parameters** steer the specific template a file selected, such as a `layout` choice that means one thing to a section template and another to the root. The merged set cannot carry them, because the page's value would shadow a middle template's value of the same name. A template reads a parameter from `_chain` instead (see: Built-in variables), where every file's frontmatter is kept apart. The same view serves a template that needs every value of one name across the stack, such as a root collecting the body classes each file declared.

## Data files

A file in the `_data` directory at the source root defines one global variable named after the file, with the file's parsed contents as its value: `_data/team.json` defines `team`. JSON and YAML files parse as data. A JavaScript module's default export is the value, so data can be computed. A variable defined both by a data file and by the configuration's globals is a build error naming both, and so is a data file whose name starts with an underscore, because the variable it would define is reserved (see: Reserved keys). Rationale: a site's structured content changes as often as its pages, so it lives in the source tree where the dev server watches it and the build can tell which pages read it, and never behind the configuration where neither can see it.

## Built-in variables

Three variables exist regardless of frontmatter. Their names start with an underscore, the prefix the source tree already gives to what belongs to the build rather than the site.

- `_url`: the page's URL (see: docs/specs/source-tree.md, URLs). It is the same in every file of the page's chain.
- `_content`: the rendered output of the file directly below in the chain. It exists only in templates, because a page has nothing below it.
- `_chain`: the frontmatter of each file below in the chain, nearest first, each as written with no merging. Rendering the root of a page that selected `_post` under `_wide`, `_chain[0]` is `_wide`'s frontmatter, `_chain[1]` is `_post`'s, and `_chain[2]` is the page's. In a page, `_chain` is empty. Rationale: the direct child is the most common read, so it sits at index zero, and a template knows its own frontmatter, so the list stops below it.

A template author reads a frontmatter variable that a page may not have set without an error. How an absent variable reads is the renderer's rule (see: docs/specs/plugins.md, Renderers).

## Relative paths

A relative path written in a page or template resolves against the directory that file belongs to, not against the page's directory when the file is a template. This binds template includes and every helper that takes a path (see: docs/specs/plugins.md, Render context). An absolute path resolves against the source root. Rationale: a template's include must resolve the same way whichever page is rendering it.
