// spec: docs/specs/build.md, Determinism

import { setTimeout } from 'node:timers/promises';
import { describe, expect, test } from 'vitest';
import { mapUnits } from './map-units.ts';

describe('mapUnits', () => {
  test("results come back in the items' order whichever unit settles first", async () => {
    const unit = async (delay: number): Promise<string> => {
      await setTimeout(delay);
      return `after ${delay}`;
    };
    await expect(mapUnits([20, 1, 10], unit)).resolves.toStrictEqual(['after 20', 'after 1', 'after 10']);
  });

  test('no items resolve to no results', async () => {
    await expect(mapUnits([], () => Promise.resolve('never'))).resolves.toStrictEqual([]);
  });

  test("a unit's rejection rejects the whole map", async () => {
    const error = new Error('unit failed');
    await expect(mapUnits([1], () => Promise.reject(error))).rejects.toBe(error);
  });
});
