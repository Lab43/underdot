# Helpers

What the helpers plugin commits to: the three helpers it registers, what each takes and returns, and the errors each raises. The plugin is a set of helpers under the plugin contract (see: q-docs/specs/plugins.md, Template helpers), and this spec holds what each helper adds to that contract.

## The plugin

The plugin is named `helpers` and registers three helpers: `activeLink`, `formatDate`, and `fileExists`. Rationale: the names are the ones a v1 site's templates call, so a migrating site changes nothing for them. The factory takes no options. Rationale: a time zone or a locale option would make a committed destination depend on a setting rather than on the source alone (see: q-docs/specs/build.md, Determinism), and no site has asked the helpers to vary in any other way.

## activeLink

A page or template calls `activeLink(href, title, attributes, wrapper)`, with `attributes` and `wrapper` optional. It returns the markup `<a href="…" …>title</a>`, or with a wrapper `<wrapper …><a href="…">title</a></wrapper>`, where `wrapper` is an element name and the attributes render on the outer element. Rationale: a navigation item whose class marks the current page is the shape a stylesheet selects on, and v1's templates wrote the link this way.

The link's class is `active` when `href` equals the page's `_url` (see: q-docs/specs/templates.md, Built-in variables), `parent` when `href` is not `/` and `_url` starts with `href` without equalling it, and nothing otherwise. Rationale: a page is the current page of its own link and not an ancestor, so an exact match is `active` alone. `/` is a prefix of every URL, so a home link marked `parent` on every page would mark nothing. The parent check is a plain prefix with no directory test, because a section's URL ends in a slash (see: q-docs/specs/source-tree.md, URLs), so a section link written as the section's URL is, trailing slash included, matches the section's pages and not a sibling whose name shares a prefix.

The rendered attributes are a copy of those given, in the order given, and the caller's object is left as it was. The class is appended to an existing `class` value after a space, is the value when the existing one is empty, and is a last attribute named `class` when none was given. Rationale: an attributes object a template shares between two calls must not carry the first call's class into the second.

Every attribute value is escaped, the `href` included: `&` to `&amp;`, `"` to `&quot;`, `<` to `&lt;`, and `>` to `&gt;`. Which class applies is decided on the `href` as written. The title, the wrapper, and the attribute names print as given. Rationale: a value with a quote or an ampersand in it would otherwise end or corrupt the attribute, while the title and the wrapper are the author's own markup, an icon as often as text.

These calls are errors:

- A `href` or a `title` that is not a string, and an empty `href`. Rationale: an empty `href` is a prefix of every URL, which would mark every page `parent`, and a link to nowhere is an author error.
- `attributes` that is not an object, `null` and an array included, attributes carrying `href`, and an attribute whose value is not a string. Rationale: the anchor already carries `href`, and a value that is not a string would print as `[object Object]`.
- A wrapper given that is not a string, and an empty wrapper. Rationale: `<></>` is not an element.

## formatDate

A page or template calls `formatDate(date, format)`. It returns the date printed with date-fns's format tokens, in UTC. The date is a `Date`, as an unquoted YAML date is (see: q-docs/specs/templates.md, Frontmatter), a string, as a date in a JSON data file is (see: q-docs/specs/templates.md, Data files), or a number of milliseconds. Rationale: the destination must not depend on the machine (see: q-docs/specs/build.md, Determinism), and a date-only value read in the machine's zone prints the day before on every machine west of Greenwich. Format tokens rather than a style, because `MMMM d, yyyy` is what a template author writes and what a v1 template holds, and the output is a function of the value and the tokens alone.

A string parses as the runtime parses it. A date alone, or a date and time with an offset, is the same instant on every machine. A time with no offset is the machine's local time, which the helper cannot tell from a zoned one, so a site writes a string date with its offset or as a date alone.

The helper takes no third argument, and a call with one is an error. Rationale: v1 passed options through to date-fns, and a site that still passes them learns it at the first build rather than having them ignored. A date that is not a `Date`, a string, or a number, and a format that is not a string, are errors. Rationale: date-fns prints `null` and `true` as 1970 in silence, and a post whose date key was misspelled is a failure the build stops for rather than a page printing 1970. What date-fns itself throws passes through as it is: a string it cannot parse, an invalid `Date`, and a wrong token such as `YYYY`, whose message already says what to write instead.

## fileExists

A page or template calls `fileExists(reference)`. It is true when a static file's output is at the reference, a private output included, and false otherwise, a page's path included. The reference resolves as a read through the render context does (see: q-docs/specs/templates.md, Relative paths): a relative one against the directory of the file being rendered, and one starting with a slash from the source root. Rationale: the served output is what a template asks about before it links to or inlines a file, so a stylesheet a handler compiled from `site.scss` is found by the name it is served under and not by its name in source. A private output reads as present because inlining a file from `_icons/` is the ordinary case for the question, and a link to one is the bust helper's error (see: q-docs/specs/bust.md, References).

A reference that is not a string is an error. A reference that resolves above the source root fails by the context's rule (see: q-docs/specs/plugins.md, Render context).
