import { onTestFinished } from 'vitest';

// Change the working directory for the test, restoring it after.
export const changeDirectory = (directory: string): void => {
  const original = process.cwd();
  process.chdir(directory);
  onTestFinished(() => {
    process.chdir(original);
  });
};
