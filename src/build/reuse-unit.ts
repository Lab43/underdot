// spec: docs/specs/build.md, Incremental builds

/**
 * What a unit can read: a source file, a handled output, a rendered body, one
 * global, every global at once, a page's resolved chain, or the pages a hook
 * sees.
 */
export type InputKind = 'file' | 'output' | 'body' | 'global' | 'globals' | 'chain' | 'pages';

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
 * what it observed. A run that throws leaves no record.
 */
export const reuseUnit = async <R>(
  records: UnitRecords<R>,
  key: string,
  lookup: (kind: InputKind, name: string) => Version,
  run: (observe: Observe) => Promise<R>,
): Promise<R> => {
  const record = records.get(key);
  if (record?.inputs.values().every(({ kind, name, version }) => lookup(kind, name) === version)) {
    return record.result;
  }
  const inputs = new Map<string, Input>();
  const result = await run((kind, name) => {
    inputs.set(`${kind}:${name}`, { kind, name, version: lookup(kind, name) });
  });
  records.set(key, { inputs, result });
  return result;
};
