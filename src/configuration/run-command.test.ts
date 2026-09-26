// spec: docs/specs/configuration.md, Commands

import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import type { TestContext } from 'node:test';
import { changeDirectory } from '../../test/helpers/change-directory.ts';
import { copyFixture } from '../../test/helpers/copy-fixture.ts';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { runCommand } from './run-command.ts';

const usage = 'Usage: underdot build [--config <path>]\n';

// Every write to stderr for the test's duration, in order.
const captureStderr = (t: TestContext): string[] => {
  const writes: string[] = [];
  t.mock.method(process.stderr, 'write', (chunk: string) => {
    writes.push(chunk);
    return true;
  });
  return writes;
};

describe('runCommand', () => {
  describe('build', () => {
    test('builds the working directory and prints nothing', async (t) => {
      const writes = captureStderr(t);
      const directory = await copyFixture(t, 'defaults');
      changeDirectory(t, directory);
      assert.equal(await runCommand(['build']), 0);
      assert.deepEqual(writes, []);
      await access(join(directory, 'build/index.html'));
    });

    test("--config builds the file's directory", async (t) => {
      const writes = captureStderr(t);
      const directory = await copyFixture(t, 'defaults');
      assert.equal(await runCommand(['build', '--config', join(directory, 'underdot.config.ts')]), 0);
      assert.deepEqual(writes, []);
      await access(join(directory, 'build/index.html'));
    });
  });

  // spec: docs/specs/build.md, Errors
  describe('build failures', () => {
    test('a missing configuration file is a failure', async (t) => {
      const writes = captureStderr(t);
      const directory = fixturePath('no-config');
      changeDirectory(t, directory);
      assert.equal(await runCommand(['build']), 1);
      assert.deepEqual(writes, [`No underdot.config.ts or underdot.config.js in ${directory}.\n`]);
    });

    test("the build's failure is printed", async (t) => {
      const writes = captureStderr(t);
      const directory = fixturePath('ts-config');
      assert.equal(await runCommand(['build', '--config', join(directory, 'underdot.config.ts')]), 1);
      assert.deepEqual(writes, [`The source root ${join(directory, 'content')} does not exist.\n`]);
    });

    test('a failure that is not an Error is printed as a string', async (t) => {
      const writes = captureStderr(t);
      assert.equal(await runCommand(['build', '--config', fixturePath('throwing-config/underdot.config.js')]), 1);
      assert.deepEqual(writes, ['The configuration refused to load.\n']);
    });
  });

  describe('usage errors', () => {
    test('the reason and the usage are printed with status 2', async (t) => {
      const writes = captureStderr(t);
      assert.equal(await runCommand([]), 2);
      assert.deepEqual(writes, [`No command given.\n${usage}`]);
    });

    test("the parser's reason is printed the same way", async (t) => {
      const writes = captureStderr(t);
      assert.equal(await runCommand(['build', '--foo']), 2);
      assert.equal(writes.length, 1);
      const [reason, ...rest] = writes[0]!.split('\n');
      assert.match(reason!, /^Unknown option '--foo'/);
      assert.equal(rest.join('\n'), usage);
    });
  });
});
