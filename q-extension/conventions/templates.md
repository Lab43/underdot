# Templates

Rules for writing a site's pages, templates, and partials.

## Format dates in a fixed zone

Never print a date through the runtime's local-time or locale methods: `toString`, `toLocaleDateString`, `getDate`, and their kin. Format it through a helper that formats in a fixed zone, such as `formatDate` from `underdot-helpers`. Write a date that is a string, as one in a JSON data file is, as a date alone or with its offset, never as a time with no zone. Rationale: the build commits to the same destination on every machine, and a date printed through the machine's zone, or a string parsed in it, breaks that commitment on the first build west of Greenwich, which the build cannot detect. A YAML date needs no offset, because YAML reads a time with none as UTC.

## Print HTML with the raw tag

In an EJS file, print `_content`, and what a helper that returns markup returns, `activeLink` from `underdot-helpers`, `inlineSvg` from `underdot-svgo`, `pageBody` from `underdot-collections`, `imageSet` from `underdot-srcset`, and `markdown` from `underdot-md` among them, with `<%- %>`, never `<%= %>`. Rationale: `_content` is the rendered output of the file below in the chain and a helper's markup is HTML already, so the escaping tag would show the markup as text.

## Include a shared partial by name

In an EJS file, include a partial that several files share by its name, with the partial's directory listed in the plugin's `views` option: `include('header')` with `views: ['_includes']`, never a relative path such as `include('../_includes/header')`. Rationale: a relative path resolves against the file rendering it, so a partial included from templates at several depths needs a path per depth, where a name reads the same everywhere. An absolute path, `include('/_includes/header')`, also reads the same everywhere, and names a partial the site keeps outside the `views` directories.
