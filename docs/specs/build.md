# Build

What one build of a site guarantees: how the destination relates to the source, in what order the work happens, when work is skipped because nothing it depends on changed, and what a failure does. A build is the same whether a command runs it once or a dev-server session runs it after every change (see: docs/specs/dev-server.md).

## Determinism

The same source directory, configuration, and plugins produce a byte-identical destination, on every run and on every machine. Nothing in the output depends on the time, the order files were read, or how the work was scheduled. Rationale: a site that commits its destination gets, from a diff after each build, proof that only what the author changed has changed. An output that varies on its own hides that signal.

An incremental build produces the same destination as a full build of the same source (see: Incremental builds). Rationale: reuse that changes the output is a bug wearing a performance improvement's clothes.

## Order of work

A build proceeds in phases. Each phase completes before the next begins, and within a phase, units run in no defined order (see: Concurrency).

1. Classify every file under the source root (see: docs/specs/source-tree.md, Classification) and parse every page's and template's frontmatter.
2. Run file handlers over every static file (see: docs/specs/plugins.md, File handlers).
3. Run page hooks (see: docs/specs/plugins.md, Page hooks).
4. Render every page's body.
5. Render every page's template chain (see: docs/specs/templates.md, Rendering the chain) and run emitted files' producers (see: docs/specs/plugins.md, Emitted files).
6. Write the destination (see: Destination).

Rationale: each boundary exists because something after it reads something before it. Helpers read handled output, page bodies read globals hooks define, and templates read rendered bodies. Producers run in the last rendering phase because helpers emit during renders.

## Destination

The destination is a directory inside the project directory, the one holding the configuration, and is neither the project directory itself nor the source root, and neither the destination nor the source root contains the other. A configuration that violates any of this is an error before any work starts. Rationale: the build owns the destination outright and deletes what it did not produce, so the destination must be a directory that holds nothing else. A destination inside the source would be classified as static files on the next build, and a source inside the destination would be deleted by it.

After a successful build the destination contains exactly the files the build produced. Every other file in it is removed. Rationale: a renamed page must not leave its old address serving stale content, and the output must be reproducible from the source alone.

A failed build stops where it failed (see: Errors).

## Incremental builds

Every unit of work has inputs (see: docs/specs/plugins.md, Dependencies). A build reruns a unit when any of its inputs changed since the unit last ran and otherwise reuses its previous result. The first build of a dev-server session runs every unit, and every later build in the session reruns only what changed. A build run on its own, outside a dev-server session, reuses nothing. Rationale: a deploy build that could inherit a stale cache is a deploy build nobody can trust, and the dev loop is where the cost of full rebuilds is paid.

The inputs a build tracks for a render are the page's own file, every template in its chain, every global name it read whether or not that name was defined, every file and handled output it read through the render context, and every rendered body it read. Rationale: a template that reads `team` before `_data/team.json` exists must re-render when the file appears.

A change to the set of files, not only to their contents, is a change to inputs. Adding, removing, or renaming a template re-resolves the chain of every page whose search path includes the template's directory, and a page whose chain changed re-renders. Adding or removing a static file, a data file, or a page reruns the hooks and re-evaluates the uniqueness rule. Rationale: template resolution is a search, and a search's result depends on what exists.

A change to the configuration or to a plugin's code invalidates everything, and the next build runs every unit.

## Concurrency

Units with no dependency between them may run at the same time, up to a limit the build chooses. The limit is not a setting of the site. Scheduling never affects the output (see: Determinism). Rationale: image derivatives dominate build time and a limit keeps memory bounded when hundreds are resized at once, and the right limit depends on the machine and the mix of work, neither of which a configuration that is committed and shared can know.

## Errors

A build stops at the first unit that fails. Units already running finish or are abandoned, nothing further starts, and the failure is reported with the attribution the plugin contract defines (see: docs/specs/plugins.md, Errors). Run on its own, the build exits with a non-zero status. Run by a dev-server session, it reports the failure to the session, which builds again on the next change (see: docs/specs/dev-server.md, Build status). Rationale: an error usually means the author is mid-edit or has one thing to fix, the fix is a rebuild away either way, and stopping keeps the report from being buried under the log of everything that ran after it.

A failed build leaves whatever it had written before stopping. The guarantee that the destination holds exactly what the build produced applies to a successful build only (see: Destination). Rationale: the exit status and the report are what tell an author or a deploy script that the build is bad, and unwinding partial output buys nothing they do not already know.
