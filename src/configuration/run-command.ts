// spec: q-docs/specs/configuration.md, Commands

import { bindReporter } from '../build/bind-reporter.ts';
import type { Reporter } from '../build/bind-reporter.ts';
import { runBuild } from '../build/run-build.ts';
import { startSession } from '../dev-server/start-session.ts';
import { describeError } from '../shared/describe-error.ts';
import { loadConfiguration } from './load-configuration.ts';
import { locateConfiguration } from './locate-configuration.ts';
import { parseCommand } from './parse-command.ts';
import type { Command } from './parse-command.ts';

const usage = 'Usage: underdot build [--config <path>] [--verbose]\n       underdot dev [--config <path>] [--port <n>] [--https] [--verbose]';

// Locate, load, build, and report a failure, which includes a configuration that fails to load.
// spec: q-docs/specs/build.md, Errors
const runBuildCommand = async ({ configurationPath }: Command, reporter: Reporter): Promise<number> => {
  try {
    await runBuild(await loadConfiguration(await locateConfiguration(configurationPath)), reporter);
    return 0;
  } catch (error) {
    reporter.failed(describeError(error));
    return 1;
  }
};

// Locate the file once, then start a session whose loader imports the file
// as it stands on each reload. The listening server keeps the process alive
// after the status is returned, until the author interrupts it.
// spec: q-docs/specs/dev-server.md, Session
const runDevCommand = async ({ configurationPath, port, https, verbose }: Extract<Command, { name: 'dev' }>, reporter: Reporter): Promise<number> => {
  try {
    const file = await locateConfiguration(configurationPath);
    let reloads = 0;
    await startSession({
      load: () => loadConfiguration(file, String(reloads++)),
      configurationFile: file,
      port,
      https,
      verbose,
    });
    return 0;
  } catch (error) {
    reporter.failed(describeError(error));
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
    // Whether the run is verbose is unknown until the arguments parse.
    bindReporter({ timestamps: false, verbose: false }).failed(`${describeError(error)}\n${usage}`);
    return 2;
  }
  const reporter = bindReporter({ timestamps: false, verbose: command.verbose });
  if (command.name === 'dev') {
    return runDevCommand(command, reporter);
  }
  return runBuildCommand(command, reporter);
};
