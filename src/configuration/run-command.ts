// spec: docs/specs/configuration.md, Commands

import { build } from '../build/build.ts';
import { loadConfiguration } from './load-configuration.ts';
import { parseCommand } from './parse-command.ts';
import type { Command } from './parse-command.ts';

const usage = 'Usage: underdot build [--config <path>]';

// The message is the whole report, so nothing is added to it.
const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Load, build, and report a failure, which includes a configuration that fails to load.
// spec: docs/specs/build.md, Errors
const runBuildCommand = async ({ configurationPath }: Command): Promise<number> => {
  try {
    await build(await loadConfiguration(configurationPath));
    return 0;
  } catch (error) {
    process.stderr.write(`${describeError(error)}\n`);
    return 1;
  }
};

// Run the command line: the arguments after the script name go in, and the
// exit status comes back for the shim to assign, so nothing here exits.
export const runCommand = async (args: string[]): Promise<number> => {
  let command: Command;
  try {
    command = parseCommand(args);
  } catch (error) {
    process.stderr.write(`${describeError(error)}\n${usage}\n`);
    return 2;
  }
  return runBuildCommand(command);
};
