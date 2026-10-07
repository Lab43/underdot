import { copyFile, writeFile } from 'node:fs/promises';
import { vi } from 'vitest';

// Every path written or copied to since the spies were last cleared, in call
// order. The test file mocks node:fs/promises with spies.
export const listWriteTargets = (): string[] =>
  [...vi.mocked(writeFile).mock.calls.map(([target]) => target), ...vi.mocked(copyFile).mock.calls.map(([, target]) => target)].map(String);
