# Templates

Rules for writing a site's pages and templates in any engine.

## Format dates in a fixed zone

Never print a date through the runtime's local-time or locale methods: `toString`, `toLocaleDateString`, `getDate`, and their kin. Format it through a helper that formats in a fixed zone, such as `formatDate` from `underdot-helpers`. Write a date that is a string, as one in a JSON data file is, as a date alone or with its offset, never as a time with no zone. Rationale: the build commits to the same destination on every machine, and a date printed through the machine's zone, or a string parsed in it, breaks that commitment on the first build west of Greenwich, which the build cannot detect. A YAML date needs no offset, because YAML reads a time with none as UTC.
