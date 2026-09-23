# Dev server

What a development session gives an author: one command that builds the site, serves it locally, rebuilds when the source changes, and reloads the browser. What a rebuild does is the build's rule (see: docs/specs/build.md); this doc covers the session around it.

## Session

A session builds the site once in full, then serves the destination and watches for changes until it is stopped. The session is the scope of incremental builds: every build after the first reruns only what changed (see: docs/specs/build.md, Incremental builds). The session serves whether or not the first build succeeded, so an author can start with a broken site and fix it while watching (see: Build status).

## Watching

The session watches every file under the source root, dotfiles and underscore-prefixed paths included, and the configuration file. A change to a source file starts an incremental build. A change to the configuration reloads it and starts a full build. A change to a plugin's code is not watched, and takes a restart. Rationale: `.htaccess` and `_data` are as much source as a page is, and a watcher that skips them misses real edits.

Changes that arrive while a build runs are held and start one build when it finishes, however many arrived. Rationale: a save that lands mid-build must not be lost, and a burst of saves must not queue a burst of builds.

## Serving

The session serves the destination over HTTP on a local port and prints the URL. It serves a directory's `index.html` for a URL ending in a slash, and redirects a URL without one to the URL with it when that is a directory, so `/about` reaches `/about/`. Rationale: that is what static hosts do with the directory form (see: docs/specs/source-tree.md, Output paths), and a link that works in development and breaks in production is the worst kind.

A URL that matches nothing is answered with a 404 status and the site's `/404.html` when the site produces one (see: docs/specs/source-tree.md, Output paths). Rationale: a site designs its own not-found page, the dev server is where its author looks at it, and serving the file static hosts serve shows the author what visitors will see.

Responses carry headers that forbid the browser from caching them. Rationale: a reload must show the build that just finished.

The session serves over HTTPS when started with the HTTPS option (see: docs/specs/configuration.md, Commands), reading the certificate and key from `localhost.pem` and `localhost-key.pem` in the project directory. When either file is missing the session fails to start and says how to generate them. Rationale: some embedded third-party services only work in a secure context, so a site that uses one cannot be developed over plain HTTP, and the files are the names mkcert produces, generated and trusted per machine and never committed.

The port is the one given on the command line (see: docs/specs/configuration.md, Commands). Given none, the session uses 3000 and takes the next free port when 3000 is busy. A port given explicitly is either taken or an error. Rationale: an author starting a second session without planning for it should not have to assign ports by hand, and one who did assign a port should not silently get another.

## Live reload

Every HTML response the session serves carries a small script that keeps a connection to the session. When a build succeeds, every connected browser reloads. The script exists only in served responses and never in the destination. Rationale: a reload the author has to trigger is a reload they forget, and a script written to the destination would ship to production.

## Build status

While a build runs, connected browsers show that a build is in progress. When a build fails, the failure report, with the attribution the build gives it (see: docs/specs/build.md, Errors), is shown in every connected browser as well as in the terminal, and the browser keeps showing the page it had. When the next build succeeds, the report is gone and the browser reloads. Rationale: the author is looking at the browser, not the terminal, when they save.
