// spec: docs/specs/configuration.md, Programmatic use

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, expect, vi } from 'vitest';
import defaultsConfiguration from '../test/fixtures/defaults/underdot.config.ts';
import { fixturePath } from '../test/helpers/fixture-path.ts';
import { test } from '../test/helpers/test.ts';
import { injectClientScript } from './dev-server/inject-client-script.ts';
import { build, dev } from './index.ts';
import { walkSource } from './source-tree/walk-source.ts';

const defaultsFixture = fixturePath('defaults');

describe('build', () => {
  test('the configuration is resolved inside the build', async () => {
    await expect(build({ destination: '..' }, defaultsFixture)).rejects.toThrow(
      new Error(`The destination ${dirname(defaultsFixture)} must be inside the project directory ${defaultsFixture}.`),
    );
  });

  // spec: docs/specs/build.md, Output
  test('a failing build rejects and prints nothing, leaving the report to the script', async ({ stdout, stderr }) => {
    await expect(build({ source: 'content' }, defaultsFixture)).rejects.toThrow(new Error(`The source root ${join(defaultsFixture, 'content')} does not exist.`));
    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual([]);
  });

  test('the project directory defaults to the working directory, and the build prints its Built line', async ({ workingDirectory, stdout }) => {
    await build(defaultsConfiguration);
    expect(stdout).toHaveLength(1);
    expect(stdout[0]).toMatch(/^✓ Built in /);
    expect(await walkSource(join(workingDirectory, 'build'))).toStrictEqual([
      '.htaccess',
      '.well-known/security.txt',
      'about/index.html',
      'about/team.txt',
      'index.html',
      'styles/site.css',
    ]);
  });
});

describe('dev', () => {
  test('the configuration is resolved before anything listens', async () => {
    await expect(dev({ destination: '..' }, {}, defaultsFixture)).rejects.toThrow(
      new Error(`The destination ${dirname(defaultsFixture)} must be inside the project directory ${defaultsFixture}.`),
    );
  });

  test('a session on a configuration value serves the working directory', async ({ workingDirectory, stdout }) => {
    const session = await dev(defaultsConfiguration, { port: 0 });
    try {
      await vi.waitFor(async () => {
        const response = await fetch(session.url);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe(injectClientScript(await readFile(join(workingDirectory, 'source/index.html'), 'utf8')));
      });
      expect(stdout[0]).toMatch(/^\d\d:\d\d:\d\d /);
      expect(stdout[0]?.slice('00:00:00 '.length)).toBe(`Serving ${session.url}\n`);
    } finally {
      await session.close();
    }
  });
});
