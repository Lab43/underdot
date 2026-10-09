# underdot-collections

Lists the pages below a directory as a global every [Underdot](https://github.com/Lab43/underdot#readme) template can read, and gives templates a helper that reads a page's rendered body.
<!-- source: docs/specs/collections.md -->

## Install

```sh
npm install underdot-collections
```

```ts
import type { Configuration } from 'underdot';
import { collections } from 'underdot-collections';
import { ejs } from 'underdot-ejs';

export default {
  plugins: [ejs(), collections({ posts: 'posts' })],
} satisfies Configuration;
```

## Collections
<!-- source: docs/specs/collections.md, Collections -->

Each collection defines a global, named by its key, listing every page below its directory at any depth. The directory's own page is left out.

- Each item is the page's frontmatter plus `_url`, the page's URL.
- The list is in the order of the pages' source paths.
- The list and its items are frozen, so sort a copy, as `toSorted` makes.

```ejs
<% for (const post of posts.toSorted((a, b) => b.date - a.date)) { %>
  <a href="<%= post._url %>"><%= post.title %></a>
<% } %>
```

## pageBody
<!-- source: docs/specs/collections.md, pageBody -->

`pageBody(url)` returns the rendered body of the page at the URL, before any template wrapped it. A template calls it, and a page body calling it is an error.

```ejs
<%- pageBody(post._url) %>
```

## Options
<!-- source: docs/specs/collections.md, Options -->

The factory takes one object. Each key is a collection's name, and each value a directory under the source root, written without a leading or trailing slash. Called with no object, it defines no collection and registers `pageBody` alone.

[`docs/specs/collections.md`](https://github.com/Lab43/underdot/blob/main/docs/specs/collections.md) holds every rule the plugin commits to.
