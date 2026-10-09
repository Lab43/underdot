# EJS

What the EJS plugin commits to: how a file renders with EJS, what a template can read, how an include finds its partial, and the one option a site configures. The plugin is a renderer under the plugin contract (see: q-docs/specs/plugins.md, Renderers), and this spec holds what EJS adds to that contract.

## Rendering

The plugin is named `ejs` and registers a renderer for the `ejs` extension, so every `.ejs` file under the source root is a page or a template (see: q-docs/specs/source-tree.md, Classification). A file renders with EJS's syntax: `<%= %>` prints a value escaped, `<%- %>` prints it as it is, and `<% %>` runs a scriptlet. Rendering is synchronous, so a template cannot `await`. Rationale: a read through the render context returns synchronously (see: q-docs/specs/plugins.md, Render context), so a template has nothing of the build's to await.

The legacy include directive, `<% include name %>`, is a syntax error. Rationale: it is the one EJS form that reads the disk behind the build, which the plugin contract forbids (see: q-docs/specs/plugins.md, Reading and writing).

A render error carries the file and the line the engine reports, with the surrounding source lines and the failing one marked. The file is the one whose line failed, so a failure inside a partial names the partial. Rationale: the build knows the template that was rendering and not the partial it included, so the engine's report is the one place the partial's name can come from.

## Variables

Every merged variable and built-in is reachable by its name (see: q-docs/specs/templates.md, Variables), so `title` reads the page's title and `_content` the rendered output below. A name no file set reads as `undefined`, which the output tags print as nothing. Rationale: a template reads attributes a page may omit (see: q-docs/specs/plugins.md, Renderers), and `undefined` is what `locals.title` yields for an absent key, so the two forms agree.

`locals` holds the same variables, so `locals.title` reads what `title` does. A variable whose name EJS itself uses, `locals` or `escapeFn`, is reachable through `locals` alone. Rationale: a variable of either name read directly would stand in for the engine's own and break the file that set it.

A runtime global such as `JSON`, `Math`, or `Date` is reachable by its name unless a variable shares it, and then the variable wins. Rationale: a template formats and serializes with the runtime's globals, and a variable an author set is never hidden by one.

`include` is the plugin's include function in every file, through `locals` too (see: Includes), so a variable named `include` is unreachable from an EJS file.

## Includes

A file includes a partial with `include(reference, data)`, where `data` is an optional object. A reference with no extension gets `.ejs`. A reference starting with a slash names a path under the source root and is read there. Any other reference is tried under the including file's directory and then under each `views` directory in order (see: Options), and the first that holds a file is the partial. Rationale: the file's own directory is where a relative path resolves (see: q-docs/specs/templates.md, Relative paths), and a shared partial is named without a path from any depth.

The partial renders under the same rules as the file that included it, entered through the render context as the file being rendered (see: q-docs/specs/plugins.md, Render context), so a relative reference inside it, and a helper called inside it, resolve against the partial's directory. It renders with the including file's variables, with the keys of `data` merged over them. Rationale: a partial is a piece of the file that includes it, so it reads what that file reads, and `data` is how one include site varies the partial.

Every partial is read through the render context, so an excluded partial is absent and one above the source root fails the build by the context's rules (see: q-docs/specs/plugins.md, Render context).

An include no candidate satisfies is an error. For a relative reference it names the directory searched, `the source root` for a file at the root, and the views directories. For an absolute reference it says nothing is under the source root at it. The engine reports it with the including file and the line of the include, as it reports any failure (see: Rendering).

## Options

The plugin's factory takes one option, `views`: a list of directories under the source root, each written without a leading slash, as `_includes`, searched for an include after the including file's own directory. It defaults to no directories. A `views` value that is not an array, and an entry that is not a string, is empty, or starts with a slash, are errors raised when the configuration loads, before any work starts. Rationale: an entry is joined under the source root, so a leading slash would read as the filesystem root. The checks exist for a site written in JavaScript, which the option's type cannot protect.

The factory takes no other option. Rationale: which extension makes a page is the site's choice through the files it writes, and an EJS option the plugin does not understand is one this spec cannot commit to.
