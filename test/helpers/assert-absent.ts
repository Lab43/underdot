import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

export const assertAbsent = async (path: string): Promise<void> => {
  await assert.rejects(stat(path), { code: 'ENOENT' });
};
