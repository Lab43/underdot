// spec: docs/specs/configuration.md, Commands

import { bindBuild } from '../build/bind-build.ts';
import { startSession } from '../dev-server/start-session.ts';
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

// Locate the file once, then start a session whose loader imports the file
// as it stands on each reload. The listening server keeps the process alive
// after the status is returned, until the author interrupts it.
// spec: docs/specs/dev-server.md, Session
const runDevCommand = async ({ configurationPath, port, https }: Extract<Command, { name: 'dev' }>): Promise<number> => {
  try {
    const file = await locateConfiguration(configurationPath);
    let reloads = 0;
    await startSession({
      load: () => loadConfiguration(file, String(reloads++)),
      configurationFile: file,
      port,
      https,
    });
    return 0;
  } catch (error) {
    process.stderr.write(`${describeError(error)}\n`);
    return 1;
  }
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
    return runDevCommand(command);
  }
  return runBuildCommand(command);
};
