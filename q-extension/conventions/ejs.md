# EJS

Rules for writing a site's EJS pages, templates, and partials.

## Print `_content` with the raw tag

Print `_content` with `<%- _content %>`, never `<%= _content %>`. Rationale: `_content` is the rendered output of the file below in the chain, which is already HTML, and the escaping tag would show its markup as text.

## Include a shared partial by name

Include a partial that several files share by its name, with the partial's directory listed in the plugin's `views` option: `include('header')` with `views: ['_includes']`, never a relative path such as `include('../_includes/header')`. Rationale: a relative path resolves against the file rendering it, so a partial included from templates at several depths needs a path per depth, where a name reads the same everywhere. An absolute path, `include('/_includes/header')`, also reads the same everywhere, and names a partial the site keeps outside the `views` directories.
