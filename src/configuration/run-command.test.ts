// spec: docs/specs/configuration.md, Commands

import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { changeDirectory } from '../../test/helpers/change-directory.ts';
import { copyFixture } from '../../test/helpers/copy-fixture.ts';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { runCommand } from './run-command.ts';

const usage = 'Usage: underdot build [--config <path>]\n';

// Every write to stderr for the test's duration, in order.
const captureStderr = (): string[] => {
  const writes: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    writes.push(String(chunk));
    return true;
  });
  return writes;
};

describe('runCommand', () => {
  describe('build', () => {
    test('builds the working directory and prints nothing', async () => {
      const writes = captureStderr();
      const directory = await copyFixture('defaults');
      changeDirectory(directory);
      expect(await runCommand(['build'])).toBe(0);
      expect(writes).toStrictEqual([]);
      await access(join(directory, 'build/index.html'));
    });

    test("--config builds the file's directory", async () => {
      const writes = captureStderr();
      const directory = await copyFixture('defaults');
      expect(await runCommand(['build', '--config', join(directory, 'underdot.config.ts')])).toBe(0);
      expect(writes).toStrictEqual([]);
      await access(join(directory, 'build/index.html'));
    });
  });

  // spec: docs/specs/build.md, Errors
  describe('build failures', () => {
    test('a missing configuration file is a failure', async () => {
      const writes = captureStderr();
      const directory = fixturePath('no-config');
      changeDirectory(directory);
      expect(await runCommand(['build'])).toBe(1);
      expect(writes).toStrictEqual([`No underdot.config.ts or underdot.config.js in ${directory}.\n`]);
    });

    test("the build's failure is printed", async () => {
      const writes = captureStderr();
      const directory = fixturePath('ts-config');
      expect(await runCommand(['build', '--config', join(directory, 'underdot.config.ts')])).toBe(1);
      expect(writes).toStrictEqual([`The source root ${join(directory, 'content')} does not exist.\n`]);
    });

    test('a failure that is not an Error is printed as a string', async () => {
      const writes = captureStderr();
      expect(await runCommand(['build', '--config', fixturePath('throwing-config/underdot.config.js')])).toBe(1);
      expect(writes).toStrictEqual(['The configuration refused to load.\n']);
    });
  });

  describe('usage errors', () => {
    test('the reason and the usage are printed with status 2', async () => {
      const writes = captureStderr();
      expect(await runCommand([])).toBe(2);
      expect(writes).toStrictEqual([`No command given.\n${usage}`]);
    });

    test("the parser's reason is printed the same way", async () => {
      const writes = captureStderr();
      expect(await runCommand(['build', '--foo'])).toBe(2);
      expect(writes).toHaveLength(1);
      const [reason, ...rest] = writes[0]!.split('\n');
      expect(reason!).toMatch(/^Unknown option '--foo'/);
      expect(rest.join('\n')).toBe(usage);
    });
  });
});
