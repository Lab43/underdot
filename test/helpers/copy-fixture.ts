import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { fixturePath } from './fixture-path.ts';

// A copy of the fixture in a temporary directory of its own, removed after
// the test. Fixtures are never written, so a test that builds builds the copy.
export const copyFixture = async (t: TestContext, name: string): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), `underdot-${name}-`));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(fixturePath(name), directory, { recursive: true });
  return directory;
};
