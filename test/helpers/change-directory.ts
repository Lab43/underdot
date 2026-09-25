import type { TestContext } from 'node:test';

// Change the working directory for the test, restoring it after.
export const changeDirectory = (t: TestContext, directory: string): void => {
  const original = process.cwd();
  process.chdir(directory);
  t.after(() => {
    process.chdir(original);
  });
};
