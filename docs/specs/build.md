# Build

What one build of a site guarantees: how the destination relates to the source, in what order the work happens, when work is skipped because nothing it depends on changed, what a failure does, and what a build prints. A build is the same whether a command runs it once or a dev-server session runs it after every change (see: docs/specs/dev-server.md).

## Determinism

The same source directory, configuration, and plugins produce a byte-identical destination, on every run and on every machine. Nothing in the output depends on the time, the order files were read, or how the work was scheduled. Rationale: a site that commits its destination gets, from a diff after each build, proof that only what the author changed has changed. An output that varies on its own hides that signal.

A file a plugin's spec names as exempt may differ from one machine to another, and is still the same on every run of one machine. Rationale: an encoder a plugin wraps may write different bytes on different machines, and a plugin's spec weighs that cost against what the file serves (see: docs/specs/srcset.md, Derivatives).

An incremental build produces the same destination as a full build of the same source (see: Incremental builds). Rationale: reuse that changes the output is a bug wearing a performance improvement's clothes.

## Order of work

A build proceeds in phases. Each phase completes before the next begins, and within a phase, units run in no defined order (see: Concurrency).

1. Classify every file under the source root (see: docs/specs/source-tree.md, Classification), parse every page's and template's frontmatter, and parse the data files (see: docs/specs/templates.md, Data files).
2. Run file handlers over every static file (see: docs/specs/plugins.md, File handlers).
3. Run page hooks (see: docs/specs/plugins.md, Page hooks). Every global is now defined, so this is where a name defined twice, or shared with a helper, is caught.
4. Render every page's body.
5. Render every page's template chain (see: docs/specs/templates.md, Rendering the chain) and run emitted files' producers (see: docs/specs/plugins.md, Emitted files).
6. Write the destination (see: Destination).

Rationale: each boundary exists because something after it reads something before it. Helpers read handled output, page bodies read globals hooks define, and templates read rendered bodies. Producers run in the last rendering phase because helpers emit during renders.

## Destination

The destination is a directory inside the project directory, the one holding the configuration, and is neither the project directory itself nor the source root, and neither the destination nor the source root contains the other. A configuration that violates any of this is an error before any work starts. Rationale: the build owns the destination outright and deletes what it did not produce, so the destination must be a directory that holds nothing else. A destination inside the source would be classified as static files on the next build, and a source inside the destination would be deleted by it.

After a successful build the destination contains exactly the files the build produced. Every other file in it is removed. Within a dev-server session, a file the build wrote whose contents it would write again is left as it is rather than written again, and a file edited inside the destination by anything but the build is outside this guarantee. Rationale: a renamed page must not leave its old address serving stale content, and the output must be reproducible from the source alone. The destination is the build's own, so a file it wrote with the contents it would write again is its output sitting where it belongs, and rewriting it is work with no reader.

A failed build stops where it failed (see: Errors).

## Incremental builds

Every unit of work has inputs (see: docs/specs/plugins.md, Dependencies). A build reruns a unit when any of its inputs changed since the unit last ran and otherwise reuses its previous result. The first build of a dev-server session runs every unit, and every later build in the session reruns only what changed. A build run on its own, outside a dev-server session, reuses nothing. Rationale: a deploy build that could inherit a stale cache is a deploy build nobody can trust, and the dev loop is where the cost of full rebuilds is paid.

An emitted file is produced again, though its inputs are unchanged, when its file is missing from the destination or its last write there did not complete. Rationale: a derivative deleted from the destination would otherwise stay missing until its source changed.

A file's change is detected by its size and modification time, and then by its contents, so a save that changed nothing reruns nothing. On a filesystem with coarse timestamps, a file rewritten to the same size within one timestamp tick of a build's stat keeps its earlier hash until it changes again or the session restarts. Rationale: a stat is cheap and a hash costs the file's bytes, and images are most of a site's bytes. The tick is a nanosecond on APFS and a few milliseconds on ext4, where a build's stat cannot fall between two saves, and a second on HFS+ or two on FAT, where it can.

The inputs a build tracks for a render are the page's own file, every template in its chain, every global name it read whether or not that name was defined, every file and handled output it read through the render context, and every rendered body it read. Rationale: a template that reads `team` before `_data/team.json` exists must re-render when the file appears.

A change to the set of files, not only to their contents, is a change to inputs. Adding, removing, or renaming a template re-resolves the chain of every page whose search path includes the template's directory, and a page whose chain changed re-renders. A page added, removed, or renamed, or a page whose frontmatter changed, reruns every hook, and a change to a page's body reruns none, because the list of pages is everything a hook is given. Adding or removing any file re-evaluates the uniqueness rule. Rationale: template resolution is a search, and a search's result depends on what exists.

A tool a handler wraps that resolves imports itself, as Sass does, reports the files it loaded and not the candidates it tried, so its unit's inputs are the files it loaded (see: docs/specs/plugins.md, Reading and writing). A file added where the tool would now resolve an import takes effect when the unit next reruns for another reason, or when the session restarts. An import that fails to resolve fails the unit, which leaves no record and so runs on every build until it resolves. Rationale: re-implementing each tool's resolution rules to record its misses would duplicate rules the tool owns and must track across its releases.

A plugin's warning prints when its unit runs, so a reused unit prints nothing (see: docs/specs/plugins.md, Errors). A build run on its own prints every warning, and a dev-server session prints a unit's warnings again whenever the unit reruns. Rationale: replaying recorded warnings on reuse would repeat every warning on every save.

A change to the configuration or to a plugin's code invalidates everything, and the next build runs every unit. A data module's own file is its input. A module it imports is treated as a plugin's code: it is not watched, and a change to it takes a restart. So is configuration a plugin reads from outside the source root, such as Browserslist's. Rationale: a plugin can declare only files under the source root (see: docs/specs/plugins.md, Reading and writing), and data a plugin release carries, such as Autoprefixer's browser tables, belongs to that release.

## Concurrency

Units with no dependency between them may run at the same time, up to a limit the build chooses. The limit is not a setting of the site. Scheduling never affects the output (see: Determinism). Rationale: image derivatives dominate build time and a limit keeps memory bounded when hundreds are resized at once, and the right limit depends on the machine and the mix of work, neither of which a configuration that is committed and shared can know.

## Errors

A build stops at the first unit that fails. Units already running finish or are abandoned, nothing further starts, and the failure is reported with the attribution the plugin contract defines (see: docs/specs/plugins.md, Errors). Run on its own, the build exits with a non-zero status. Run by a dev-server session, it reports the failure to the session, which builds again on the next change (see: docs/specs/dev-server.md, Build status). Rationale: an error usually means the author is mid-edit or has one thing to fix, the fix is a rebuild away either way, and stopping keeps the report from being buried under the log of everything that ran after it.

A plugin's warning is not a failure. The build continues, and the warning leaves the exit status alone (see: docs/specs/plugins.md, Errors).

A failed build leaves whatever it had written before stopping. The guarantee that the destination holds exactly what the build produced applies to a successful build only (see: Destination). Rationale: the exit status and the report are what tell an author or a deploy script that the build is bad, and unwinding partial output buys nothing they do not already know.

## Output

A successful build prints `✓ Built in <duration>` on standard output. The build command prints a failed build's report on standard error, with `✗` before the report's first line. The exported build function rejects with the report and prints nothing (see: docs/specs/configuration.md, Programmatic use). Rationale: the rejection is the function's form of the command's exit status and printed report, so the script that called it decides whether and how to show the error, and printing it as well would show it twice in a script that logs what it catches. A plugin's warning prints as the plugin contract defines (see: docs/specs/plugins.md, Errors).

The lines are colored when their stream is a terminal: a success in green, a failure in red, and a warning in yellow. They print plain when the stream is piped or `NO_COLOR` is set, unless `FORCE_COLOR` asks for color. Rationale: the symbols tell a success, a failure, and a warning apart where color is off, under `NO_COLOR`, in a CI log, or for a reader who does not see the colors.
