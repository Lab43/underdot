import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as base, vi } from 'vitest';
import { fixturePath } from './fixture-path.ts';

// Every write to the stream for the test's duration, in order, with the
// stream silenced. restoreMocks puts the stream back.
const capture = (stream: NodeJS.WriteStream): string[] => {
  const writes: string[] = [];
  vi.spyOn(stream, 'write').mockImplementation((chunk) => {
    writes.push(String(chunk));
    return true;
  });
  return writes;
};

// The fixture a test takes its directory from, the copy of that fixture the
// test may write, the copy as the working directory, and the writes to each
// standard stream. Fixtures are never written, so a test that builds builds
// the copy.
export const test = base.extend<{ fixture: string; directory: string; workingDirectory: string; stdout: string[]; stderr: string[] }>({
  fixture: 'defaults',
  directory: async ({ fixture }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `underdot-${fixture}-`));
    try {
      await cp(fixturePath(fixture), directory, { recursive: true });
      await use(directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  // The path as the process reports it, since the temporary directory may
  // sit behind a symlink that process.cwd() resolves.
  workingDirectory: async ({ directory }, use) => {
    const original = process.cwd();
    process.chdir(directory);
    await use(process.cwd());
    process.chdir(original);
  },
  stdout: async ({}, use) => {
    await use(capture(process.stdout));
  },
  stderr: async ({}, use) => {
    await use(capture(process.stderr));
  },
});
