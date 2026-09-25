// spec: docs/specs/build.md

// A unit of work, started by the runner when a slot frees.
export type Unit = () => Promise<void>;

// How many units run at once. Not a setting of the site.
const limit = 10;

// Runs every unit with at most `limit` in flight. After one fails, nothing
// further starts, the units in flight settle, and the first error is thrown.
export const runUnits = async (units: Unit[]): Promise<void> => {
  const queue = units.values();
  let failure: { error: unknown } | undefined;
  const worker = async (): Promise<void> => {
    for (const unit of queue) {
      if (failure !== undefined) {
        return;
      }
      try {
        await unit();
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, units.length) }, worker));
  if (failure !== undefined) {
    throw failure.error;
  }
};
