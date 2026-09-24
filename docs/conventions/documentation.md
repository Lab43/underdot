# Documentation

This project's documentation rulings and deviations (see: @lab43/q conventions/conventions.md, Three tiers of conventions).

## Spec markers name the doc

A spec marker names the spec doc and no section, and sits at the top of the file the spec governs, followed by a blank line so it reads as the file's marker and not the first statement's (overrides: @lab43/q conventions/documentation.md, Markers). A unit inside that file which enforces a different spec, a function or a test block, carries that spec's marker at its head. Never mark individual checks (overrides: @lab43/q conventions/specs.md, Enforcement). Rationale: a reader of the code wants to know which spec governs the file, and a file that switches section names every few lines tells them nothing they can use. An amendment to a section greps to the files that enforce the spec and reads them, which the enforcement rule already calls the floor of the search.
