// spec: docs/specs/configuration.md, Commands

import { bindBuild } from '../build/bind-build.ts';
import { describeError } from '../shared/describe-error.ts';
import { loadConfiguration } from './load-configuration.ts';
import { locateConfiguration } from './locate-configuration.ts';
import { parseCommand } from './parse-command.ts';
import type { Command } from './parse-command.ts';

const usage = 'Usage: underdot build [--config <path>]\n       underdot dev [--config <path>] [--port <n>] [--https]';

// Locate, load, build, and report a failure, which includes a configuration that fails to load.
// spec: docs/specs/build.md, Errors
const runBuildCommand = async ({ configurationPath }: Command): Promise<number> => {
  try {
    await bindBuild(await loadConfiguration(await locateConfiguration(configurationPath)))();
    return 0;
  } catch (error) {
    process.stderr.write(`${describeError(error)}\n`);
    return 1;
  }
};

const runDevCommand = (): number => {
  process.stderr.write('The dev command is not available yet.\n');
  return 2;
};

/**
 * Run the command line: the arguments after the script name go in, and the
 * exit status comes back for the shim to assign, so nothing here exits.
 */
export const runCommand = async (args: string[]): Promise<number> => {
  let command: Command;
  try {
    command = parseCommand(args);
  } catch (error) {
    process.stderr.write(`${describeError(error)}\n${usage}\n`);
    return 2;
  }
  if (command.name === 'dev') {
    return runDevCommand();
  }
  return runBuildCommand(command);
};
