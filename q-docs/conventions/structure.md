# Structure

Rules for how the source is divided into modules: what a module holds, what it is named, and where it lives.

## Names

Name a module that exports one function after that function, so `load-configuration.ts` exports `loadConfiguration`. Lint holds every module to named exports. Rejected: naming a module after its subject. A subject collects every function about it, and the reader who finishes one function finds another's helpers below it.

An entry that exports nothing is named after what it installs, since it has no function to take a name from, as `src/underdot.ts` is.

## Types

Declare a type in the module whose function produces its values, and import it from there wherever it is consumed, so the import graph follows the data flow: `src/templates/render-pages.ts` declares `RenderedPage` and `src/build/write-destination.ts` imports it. Rationale: the code that constructs and checks a value sits with its type, so a reader asking what a field means finds the code that sets it in the same file. Rejected: a central types module, which detaches a type from the code that makes its values and has no function to be named after. The types a site imports are re-exported from `src/index.ts`, which is the one place they gather.

## Directories

Group the core package's modules into directories named after the spec each enforces, as `src/build/` holds the modules enforcing `q-docs/specs/build.md`. A module's spec marker names its directory's spec, and its test sits beside it. Rationale: the spec a module enforces is the grouping its marker already carries, so a reader with a spec open knows where its code is, and no plan re-argues where a module goes. Rejected: grouping by pipeline stage, which has no anchor outside the code and moves as the pipeline does.

A module that enforces no spec and that two spec directories need lives in `src/shared/`, named after its one function with its test beside it and no spec marker, as `src/shared/is-object.ts` does. Rationale: copying it into each directory is the duplication the copy rule forbids (see: @lab43/q conventions/principles.md, Copying is the signal to extract), and placing it in one directory has the other import across a spec boundary for something neither spec owns. Rejected: keeping such a module at the root, which the entries have to themselves.

A plugin package under `plugins/<name>/` enforces `q-docs/specs/<name>.md`. Its `src/index.ts` exports the factory and the options type a site imports, and the modules doing the work sit beside the entry, each named after its one function with its test beside it. A declaration file patching a dependency's types sits beside them. It has no spec directories, because the package enforces one spec. Rationale: the entry is thin for the reason the core's is, and a directory inside the package named after the package's own spec would repeat the package's name. Rejected: one module holding the factory and the renderer, which gives the entry work to do.

The core package's entries stay at the root: `src/index.ts`, which a script imports, and `src/underdot.ts`, the command the `bin` field installs. `src/index.ts` holds the exported functions in the signatures the specs name, each a thin call into the module that does the work, so a module's own signature can take what the pipeline needs rather than what a script passes.
