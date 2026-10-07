// spec: docs/specs/configuration.md, Commands

import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, onTestFinished, vi } from 'vitest';
import { test } from '../test/helpers/test.ts';
import { runCommand } from './configuration/run-command.ts';

vi.mock('./configuration/run-command.ts');

const shim = fileURLToPath(new URL('./underdot.ts', import.meta.url));

// Type stripping runs the shim from source, so this needs no build.
const runShim = (args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> =>
  promisify(execFile)(process.execPath, [shim, ...args], { cwd });

describe('underdot', () => {
  test('the arguments after the script go to the command, and its status is the exit status', async () => {
    const { argv, exitCode } = process;
    onTestFinished(() => {
      Object.assign(process, { argv, exitCode });
    });
    process.argv = ['node', 'underdot', 'build', '--config', 'site/underdot.config.ts'];
    vi.mocked(runCommand).mockResolvedValue(3);
    await import('./underdot.ts');
    expect(runCommand).toHaveBeenCalledWith(['build', '--config', 'site/underdot.config.ts']);
    expect(process.exitCode).toBe(3);
  });

  test('build exits 0 with nothing on stderr and builds the working directory', async ({ directory }) => {
    const { stderr } = await runShim(['build'], directory);
    expect(stderr).toBe('');
    await access(join(directory, 'build/index.html'));
  });

  test('no arguments exits 2 with the usage on stderr', async () => {
    await expect(runShim([])).rejects.toMatchObject({
      code: 2,
      stderr: 'No command given.\nUsage: underdot build [--config <path>]\n       underdot dev [--config <path>] [--port <n>] [--https]\n',
    });
  });
});
