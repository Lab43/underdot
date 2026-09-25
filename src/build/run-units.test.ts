// spec: docs/specs/build.md

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runUnits } from './run-units.ts';

interface FakeUnit {
  started: boolean;
  run: () => Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

// A unit that records when it starts and settles on demand.
const fakeUnit = (): FakeUnit => {
  const { promise, resolve, reject }: PromiseWithResolvers<void> = Promise.withResolvers();
  const unit: FakeUnit = {
    started: false,
    run: () => {
      unit.started = true;
      return promise;
    },
    resolve,
    reject,
  };
  return unit;
};

const fakeUnits = (count: number): FakeUnit[] => Array.from({ length: count }, fakeUnit);
const started = (units: FakeUnit[]): number => units.filter((unit) => unit.started).length;

// Let every settled promise run its continuations.
const settle = (): Promise<void> => setImmediate();

// Whether a promise has settled, without awaiting it.
const watch = (promise: Promise<void>): { settled: () => boolean } => {
  let done = false;
  promise.then(() => { done = true; }, () => { done = true; });
  return { settled: () => done };
};

describe('runUnits', () => {
  test('every unit runs and the promise resolves', async () => {
    const units = fakeUnits(3);
    const run = runUnits(units.map((unit) => unit.run));
    await settle();
    assert.equal(started(units), 3);
    for (const unit of units) {
      unit.resolve();
    }
    await run;
  });

  test('an empty list resolves', async () => {
    await runUnits([]);
  });

  test('never more than 10 units are in flight, and an 11th starts only after one settles', async () => {
    const units = fakeUnits(25);
    const run = runUnits(units.map((unit) => unit.run));
    await settle();
    assert.equal(started(units), 10);
    units[0]!.resolve();
    await settle();
    assert.equal(started(units), 11);
    for (const unit of units) {
      unit.resolve();
    }
    await run;
    assert.equal(started(units), 25);
  });

  test('after one unit rejects, nothing further starts and the first error is thrown once the units in flight settle', async () => {
    const units = fakeUnits(12);
    const run = runUnits(units.map((unit) => unit.run));
    const state = watch(run);
    await settle();
    assert.equal(started(units), 10);

    const first = new Error('first');
    units[0]!.reject(first);
    await settle();
    assert.equal(started(units), 10);
    assert.equal(state.settled(), false);

    units[1]!.reject(new Error('second'));
    for (const unit of units.slice(2, 10)) {
      unit.resolve();
    }
    await assert.rejects(run, (error) => error === first);
    assert.equal(started(units), 10);
  });
});
