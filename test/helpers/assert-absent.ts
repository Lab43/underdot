import { stat } from 'node:fs/promises';
import { expect } from 'vitest';

export const assertAbsent = async (path: string): Promise<void> => {
  await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
};
