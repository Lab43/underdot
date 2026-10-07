// spec: docs/specs/configuration.md, Commands

import { execFile, spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
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

  test('dev serves the working directory until it is killed', async ({ directory }) => {
    const child = spawn(process.execPath, [shim, 'dev', '--port', '0'], { cwd: directory });
    onTestFinished(() => {
      child.kill();
    });
    let output = '';
    const printed = await new Promise<string>((resolve, reject) => {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        output += chunk;
        if (output.includes('Built in')) {
          resolve(output);
        }
      });
      child.on('exit', (code) => {
        reject(new Error(`The command exited with ${code} before building.`));
      });
    });
    const url = /^Serving (\S+)$/m.exec(printed)?.[1];
    expect(url).toBeDefined();
    const response = await fetch(url!);
    expect(await response.text()).toBe(await readFile(join(directory, 'source/index.html'), 'utf8'));
  });

  test('no arguments exits 2 with the usage on stderr', async () => {
    await expect(runShim([])).rejects.toMatchObject({
      code: 2,
      stderr: 'No command given.\nUsage: underdot build [--config <path>]\n       underdot dev [--config <path>] [--port <n>] [--https]\n',
    });
  });
});
