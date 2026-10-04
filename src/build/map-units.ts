// spec: docs/specs/build.md, Determinism

import { runUnits } from './run-units.ts';

/**
 * Each result lands in the slot of its own index, so the results keep the
 * items' order whichever unit settles first.
 */
export const mapUnits = async <T, R>(items: T[], unit: (item: T) => Promise<R>): Promise<R[]> => {
  const results = new Array<R>(items.length);
  await runUnits(items.map((item, index) => async () => {
    results[index] = await unit(item);
  }));
  return results;
};
