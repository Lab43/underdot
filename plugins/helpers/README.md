# underdot-helpers

Gives [Underdot](https://github.com/Lab43/underdot#readme) templates three helpers: `activeLink`, `formatDate`, and `fileExists`.
<!-- source: docs/specs/helpers.md -->

## Install

```sh
npm install underdot-helpers
```

```ts
import type { Configuration } from 'underdot';
import { ejs } from 'underdot-ejs';
import { helpers } from 'underdot-helpers';

export default {
  plugins: [ejs(), helpers()],
} satisfies Configuration;
```

## activeLink
<!-- source: docs/specs/helpers.md, activeLink -->

`activeLink(href, title, attributes, wrapper)` returns a link marked when it points at the current page. `attributes` and `wrapper` are optional.

- The link's class is `active` when `href` is the page's URL.
- The class is `parent` when the page's URL starts with `href`, other than `/`.
- With a `wrapper`, an element name, the link sits inside that element, and the attributes and the class go on the wrapper.
- Every attribute value is escaped, the `href` included.

```ejs
<%- activeLink('/about/', 'About', { class: 'nav' }, 'li') %>
```

## formatDate
<!-- source: docs/specs/helpers.md, formatDate -->

`formatDate(date, format)` prints a date with [date-fns](https://date-fns.org/docs/format) format tokens, in UTC, so a date prints the same on every machine. The date is a `Date`, a string, or a number of milliseconds.

```ejs
<%= formatDate(date, 'MMMM d, yyyy') %>
```

A string date with a time and no offset reads as the machine's local time, so write a string date with its offset or as a date alone.

## fileExists
<!-- source: docs/specs/helpers.md, fileExists -->

`fileExists(reference)` is true when a static file's output is at the reference, a private one included. A relative reference resolves against the file being rendered, and one starting with a slash from the source root. It answers for the output, so a stylesheet compiled from `site.scss` is found as `site.css`.

## Options
<!-- source: docs/specs/helpers.md, The plugin -->

The plugin takes no options.

[`docs/specs/helpers.md`](https://github.com/Lab43/underdot/blob/main/docs/specs/helpers.md) holds every rule the plugin commits to, the errors each helper raises included.
