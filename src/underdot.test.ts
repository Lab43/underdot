// spec: docs/specs/configuration.md, Commands

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { copyFixture } from '../test/helpers/copy-fixture.ts';

const shim = fileURLToPath(new URL('./underdot.ts', import.meta.url));

// Type stripping runs the shim from source, so this needs no build.
const runShim = (args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> =>
  promisify(execFile)(process.execPath, [shim, ...args], { cwd });

describe('underdot', () => {
  test('build exits 0 with nothing on stderr and builds the working directory', async (t) => {
    const directory = await copyFixture(t, 'defaults');
    const { stderr } = await runShim(['build'], directory);
    assert.equal(stderr, '');
    await access(join(directory, 'build/index.html'));
  });

  test('no arguments exits 2 with the usage on stderr', async () => {
    await assert.rejects(runShim([]), {
      code: 2,
      stderr: 'No command given.\nUsage: underdot build [--config <path>]\n',
    });
  });
});
