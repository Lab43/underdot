// spec: q-docs/specs/build.md, Output

import type { ResolvedConfiguration } from '../configuration/resolve-configuration.ts';
import { bindBuild } from './bind-build.ts';
import type { Reporter } from './bind-reporter.ts';

/**
 * Build a resolved configuration once and report how long it took and how
 * many units it ran. A failure throws past the report, for the caller to
 * report or rethrow.
 */
export const runBuild = async (configuration: ResolvedConfiguration, reporter: Reporter): Promise<void> => {
  const started = performance.now();
  const counts = await bindBuild(configuration, reporter)();
  reporter.built(performance.now() - started, counts);
};
