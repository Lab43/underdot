// spec: docs/specs/build.md, Incremental builds

import { describe, expect, test, vi } from 'vitest';
import { reuseUnit } from './reuse-unit.ts';
import type { InputKind, Observe, UnitRecords, Version } from './reuse-unit.ts';

// A lookup answering from a table of `${kind}:${name}`.
const lookupIn = (versions: Record<string, Version>) => (kind: InputKind, name: string): Version => versions[`${kind}:${name}`];

describe('reuseUnit', () => {
  test('a first call runs the unit and records what it observed at the versions seen', async () => {
    const records: UnitRecords<string> = new Map();
    const run = vi.fn((observe: Observe) => {
      observe('file', 'index.tpl');
      observe('global', 'missing');
      return Promise.resolve('result');
    });
    await expect(reuseUnit(records, 'index.tpl', lookupIn({ 'file:index.tpl': 'a' }), run)).resolves.toBe('result');
    expect(run).toHaveBeenCalledTimes(1);
    expect(records.get('index.tpl')).toStrictEqual({
      inputs: new Map([
        ['file:index.tpl', { kind: 'file', name: 'index.tpl', version: 'a' }],
        ['global:missing', { kind: 'global', name: 'missing', version: undefined }],
      ]),
      result: 'result',
    });
  });

  test('a second call with every version equal reuses the result without running', async () => {
    const records: UnitRecords<string> = new Map();
    const run = vi.fn((observe: Observe) => {
      observe('file', 'index.tpl');
      return Promise.resolve('result');
    });
    const lookup = lookupIn({ 'file:index.tpl': 'a' });
    await reuseUnit(records, 'index.tpl', lookup, run);
    await expect(reuseUnit(records, 'index.tpl', lookup, run)).resolves.toBe('result');
    expect(run).toHaveBeenCalledTimes(1);
  });

  test('one changed version reruns the unit and replaces the record', async () => {
    const records: UnitRecords<string> = new Map();
    let text = 'first';
    const run = vi.fn((observe: Observe) => {
      observe('file', 'index.tpl');
      observe('file', '_.tpl');
      return Promise.resolve(text);
    });
    await reuseUnit(records, 'index.tpl', lookupIn({ 'file:index.tpl': 'a', 'file:_.tpl': 'b' }), run);
    text = 'second';
    await expect(reuseUnit(records, 'index.tpl', lookupIn({ 'file:index.tpl': 'a', 'file:_.tpl': 'c' }), run)).resolves.toBe('second');
    expect(run).toHaveBeenCalledTimes(2);
    expect(records.get('index.tpl')?.inputs.get('file:_.tpl')).toStrictEqual({ kind: 'file', name: '_.tpl', version: 'c' });
  });

  test('an input recorded absent that now has a version reruns the unit', async () => {
    const records: UnitRecords<string> = new Map();
    const run = vi.fn((observe: Observe) => {
      observe('global', 'tagline');
      return Promise.resolve('result');
    });
    await reuseUnit(records, 'index.tpl', lookupIn({}), run);
    await reuseUnit(records, 'index.tpl', lookupIn({ 'global:tagline': 'a' }), run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  test('a run that throws leaves no record, and the next call runs again', async () => {
    const records: UnitRecords<string> = new Map();
    const run = vi.fn((observe: Observe) => {
      observe('file', 'index.tpl');
      return Promise.reject(new Error('boom'));
    });
    await expect(reuseUnit(records, 'index.tpl', lookupIn({}), run)).rejects.toThrow(new Error('boom'));
    expect(records.size).toBe(0);
    await expect(reuseUnit(records, 'index.tpl', lookupIn({}), run)).rejects.toThrow(new Error('boom'));
    expect(run).toHaveBeenCalledTimes(2);
  });

  test('a run that observes nothing is reused forever', async () => {
    const records: UnitRecords<number> = new Map();
    const run = vi.fn(() => Promise.resolve(42));
    await reuseUnit(records, 'constant', lookupIn({}), run);
    await reuseUnit(records, 'constant', lookupIn({ 'file:index.tpl': 'a' }), run);
    await expect(reuseUnit(records, 'constant', lookupIn({ 'file:index.tpl': 'b' }), run)).resolves.toBe(42);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test('records are kept per key', async () => {
    const records: UnitRecords<string> = new Map();
    const run = vi.fn((observe: Observe) => {
      observe('file', 'index.tpl');
      return Promise.resolve('result');
    });
    await reuseUnit(records, 'a', lookupIn({}), run);
    await reuseUnit(records, 'b', lookupIn({}), run);
    expect(run).toHaveBeenCalledTimes(2);
    expect([...records.keys()]).toStrictEqual(['a', 'b']);
  });
});
