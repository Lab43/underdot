// spec: docs/specs/build.md, Incremental builds

import type { Reporter } from './bind-reporter.ts';

/**
 * What a unit can read: a source file, a handled output, a rendered body, one
 * global, every global at once, a page's resolved chain, the pages a hook
 * sees, or the parameters an emitted file was emitted with.
 */
export type InputKind = 'file' | 'output' | 'body' | 'global' | 'globals' | 'chain' | 'pages' | 'parameters';

/**
 * How an input stood when it was read, or no value for one that did not exist.
 */
export type Version = string | undefined;

/**
 * Records a read of an input under the unit that is running.
 */
export type Observe = (kind: InputKind, name: string) => void;

interface Input {
  kind: InputKind;
  name: string;
  version: Version;
}

/**
 * An input whose version differs from the one the unit saw when it last ran:
 * added when it did not exist then, removed when it does not exist now, and
 * changed otherwise.
 */
export interface ChangedInput {
  kind: InputKind;
  name: string;
  status: 'added' | 'removed' | 'changed';
}

/**
 * What a unit observed the last time it ran, keyed by `${kind}:${name}`, and
 * what it produced.
 */
export interface UnitRecord<R> {
  inputs: Map<string, Input>;
  result: R;
}

/**
 * The records of every unit of one kind, by the unit's key.
 */
export type UnitRecords<R> = Map<string, UnitRecord<R>>;

/**
 * The recorded result when every input the unit observed last time is at the
 * version it saw, and otherwise the result of running it again, recorded with
 * what it observed. A run that throws leaves no record. The unit is reported
 * under its label as reused, or as ran with the inputs that changed, which
 * are none for a unit with no record.
 */
export const reuseUnit = async <R>(
  records: UnitRecords<R>,
  key: string,
  lookup: (kind: InputKind, name: string) => Version,
  run: (observe: Observe) => Promise<R>,
  reporter: Reporter,
  unit: string,
): Promise<R> => {
  const record = records.get(key);
  const changes: ChangedInput[] = [];
  for (const { kind, name, version } of record?.inputs.values() ?? []) {
    const current = lookup(kind, name);
    if (current === version) {
      continue;
    }
    let status: ChangedInput['status'] = 'changed';
    if (version === undefined) {
      status = 'added';
    } else if (current === undefined) {
      status = 'removed';
    }
    changes.push({ kind, name, status });
  }
  if (record !== undefined && changes.length === 0) {
    // spec: docs/specs/build.md, Output
    reporter.reused(unit);
    return record.result;
  }
  const inputs = new Map<string, Input>();
  const result = await run((kind, name) => {
    inputs.set(`${kind}:${name}`, { kind, name, version: lookup(kind, name) });
  });
  records.set(key, { inputs, result });
  // spec: docs/specs/build.md, Output
  reporter.ran(unit, changes);
  return result;
};
