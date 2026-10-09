// spec: q-docs/specs/build.md, Output

import { join } from 'node:path';
import { describe, expect } from 'vitest';
import defaultsConfiguration from '../../test/fixtures/defaults/underdot.config.ts';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { makeReporter } from '../../test/helpers/make-reporter.ts';
import { test } from '../../test/helpers/test.ts';
import { resolveConfiguration } from '../configuration/resolve-configuration.ts';
import { runBuild } from './run-build.ts';

describe('runBuild', () => {
  test('a build reports its duration and its counts once', async ({ directory }) => {
    const reporter = makeReporter();
    await runBuild(resolveConfiguration(defaultsConfiguration, directory), reporter);
    // The defaults fixture's eight static files, each handled for the first time.
    expect(reporter.built).toHaveBeenCalledExactlyOnceWith(expect.any(Number), { ran: 8, reused: 0 });
  });

  test('a failing build rejects and reports nothing', async () => {
    const directory = fixturePath('defaults');
    const reporter = makeReporter();
    await expect(runBuild(resolveConfiguration({ source: 'content' }, directory), reporter)).rejects.toThrow(
      new Error(`The source root ${join(directory, 'content')} does not exist.`),
    );
    expect(Object.values(reporter).filter((method) => method.mock.calls.length > 0)).toStrictEqual([]);
  });
});
