// spec: docs/specs/configuration.md, Commands

import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { test } from '../../test/helpers/test.ts';
import { startSession } from '../dev-server/start-session.ts';
import { runCommand } from './run-command.ts';

vi.mock('../dev-server/start-session.ts', { spy: true });

const usage = 'Usage: underdot build [--config <path>]\n       underdot dev [--config <path>] [--port <n>] [--https]\n';

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

  // spec: docs/specs/dev-server.md, Session
  describe('dev', () => {
    test('starts a session on the located file with the port and the HTTPS flag, loading the file as it stands', async ({ stderr, stdout, workingDirectory }) => {
      expect(await runCommand(['dev', '--port', '0'])).toBe(0);
      const session = await vi.mocked(startSession).mock.results[0]!.value;
      try {
        expect(stderr).toStrictEqual([]);
        const file = join(workingDirectory, 'underdot.config.ts');
        expect(startSession).toHaveBeenCalledWith({ load: expect.any(Function), configurationFile: file, port: 0, https: false });
        const { load } = vi.mocked(startSession).mock.calls[0]![0];
        await writeFile(file, "export default { source: 'content' };\n");
        expect((await load()).source).toBe(join(workingDirectory, 'content'));
        expect(stdout[0]).toMatch(/^Serving http:\/\/localhost:\d+\/\n$/);
      } finally {
        await session.close();
      }
    });

    describe('in the no-config fixture', () => {
      test.override({ fixture: 'no-config' });

      test('a missing configuration file fails the start', async ({ stderr, workingDirectory }) => {
        expect(await runCommand(['dev'])).toBe(1);
        expect(stderr).toStrictEqual([`No underdot.config.ts or underdot.config.js in ${workingDirectory}.\n`]);
      });
    });
  });

  describe('usage errors', () => {
    test('the reason and the usage are printed with status 2', async ({ stderr }) => {
      expect(await runCommand([])).toBe(2);
      expect(stderr).toStrictEqual([`No command given.\n${usage}`]);
    });

    test('an option that belongs to dev is refused by build', async ({ stderr }) => {
      expect(await runCommand(['build', '--port', '1'])).toBe(2);
      expect(stderr).toStrictEqual([`The --port option belongs to dev.\n${usage}`]);
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
