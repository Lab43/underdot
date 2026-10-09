// spec: q-docs/specs/build.md, Incremental builds

import type { HookGlobal } from '../plugins/run-page-hooks.ts';
import type { DataVariable } from '../templates/read-data.ts';
import type { FileTable } from './hash-files.ts';

/**
 * Every global's version by name: a constant for a configuration global,
 * which cannot change within a bound build, the hashes of every file at or
 * under a data variable's path, and a hook global's own version.
 */
export const versionGlobals = (
  globals: Record<string, unknown>,
  dataVariables: DataVariable[],
  hookGlobals: HookGlobal[],
  files: FileTable,
): Map<string, string> => {
  const versions = new Map<string, string>();
  for (const name of Object.keys(globals)) {
    versions.set(name, 'configuration');
  }
  for (const { name, sourcePath } of dataVariables) {
    const lines: string[] = [];
    for (const [path, { hash }] of files) {
      if (path === sourcePath || path.startsWith(`${sourcePath}/`)) {
        lines.push(`${path}:${hash}`);
      }
    }
    versions.set(name, lines.sort().join('\n'));
  }
  for (const { name, version } of hookGlobals) {
    versions.set(name, version);
  }
  return versions;
};
