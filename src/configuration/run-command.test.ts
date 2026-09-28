// spec: docs/specs/configuration.md, Commands

import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { test as base } from '../../test/helpers/test.ts';
import { runCommand } from './run-command.ts';

const usage = 'Usage: underdot build [--config <path>]\n';

// Every write to stderr for the test's duration, in order.
const test = base.extend<{ stderr: string[] }>({
  stderr: async ({}, use) => {
    const writes: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    await use(writes);
  },
});

describe('runCommand', () => {
  describe('build', () => {
    test('builds the working directory and prints nothing', async ({ stderr, workingDirectory }) => {
      expect(await runCommand(['build'])).toBe(0);
      expect(stderr).toStrictEqual([]);
      await access(join(workingDirectory, 'build/index.html'));
    });

    test("--config builds the file's directory", async ({ stderr, directory }) => {
      expect(await runCommand(['build', '--config', join(directory, 'underdot.config.ts')])).toBe(0);
      expect(stderr).toStrictEqual([]);
      await access(join(directory, 'build/index.html'));
    });
  });

  // spec: docs/specs/build.md, Errors
  describe('build failures', () => {
    describe('in the no-config fixture', () => {
      test.override({ fixture: 'no-config' });

      test('a missing configuration file is a failure', async ({ stderr, workingDirectory }) => {
        expect(await runCommand(['build'])).toBe(1);
        expect(stderr).toStrictEqual([`No underdot.config.ts or underdot.config.js in ${workingDirectory}.\n`]);
      });
    });

    test("the build's failure is printed", async ({ stderr }) => {
      const directory = fixturePath('ts-config');
      expect(await runCommand(['build', '--config', join(directory, 'underdot.config.ts')])).toBe(1);
      expect(stderr).toStrictEqual([`The source root ${join(directory, 'content')} does not exist.\n`]);
    });

    test('a failure that is not an Error is printed as a string', async ({ stderr }) => {
      expect(await runCommand(['build', '--config', fixturePath('throwing-config/underdot.config.js')])).toBe(1);
      expect(stderr).toStrictEqual(['The configuration refused to load.\n']);
    });
  });

  describe('usage errors', () => {
    test('the reason and the usage are printed with status 2', async ({ stderr }) => {
      expect(await runCommand([])).toBe(2);
      expect(stderr).toStrictEqual([`No command given.\n${usage}`]);
    });

    test("the parser's reason is printed the same way", async ({ stderr }) => {
      expect(await runCommand(['build', '--foo'])).toBe(2);
      expect(stderr).toHaveLength(1);
      const [reason, ...rest] = stderr[0]!.split('\n');
      expect(reason!).toMatch(/^Unknown option '--foo'/);
      expect(rest.join('\n')).toBe(usage);
    });
  });
});
