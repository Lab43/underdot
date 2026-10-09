// spec: q-docs/specs/configuration.md, Commands

import { parseArgs } from 'node:util';

export type Command =
  | { name: 'build'; configurationPath: string | undefined; verbose: boolean }
  | { name: 'dev'; configurationPath: string | undefined; port: number | undefined; https: boolean; verbose: boolean };

const options = {
  config: { type: 'string' },
  port: { type: 'string' },
  https: { type: 'boolean' },
  verbose: { type: 'boolean' },
} as const;

/**
 * The command a command line names, or a thrown usage error whose message
 * is the reason. The parser's own errors say what is wrong, so they propagate.
 */
export const parseCommand = (args: string[]): Command => {
  const { positionals, values } = parseArgs({ args, options, allowPositionals: true, strict: true });
  const [name, extra] = positionals;
  if (name === undefined) {
    throw new Error('No command given.');
  }
  if (name !== 'build' && name !== 'dev') {
    throw new Error(`Unknown command: ${name}.`);
  }
  if (extra !== undefined) {
    throw new Error(`Unexpected argument: ${extra}.`);
  }
  // The parser knows no subcommands, so which options belong to which is checked here.
  if (name === 'build') {
    if (values.port !== undefined) {
      throw new Error('The --port option belongs to dev.');
    }
    if (values.https !== undefined) {
      throw new Error('The --https option belongs to dev.');
    }
    return { name, configurationPath: values.config, verbose: values.verbose ?? false };
  }
  let port: number | undefined;
  if (values.port !== undefined) {
    if (!/^\d+$/.test(values.port) || Number(values.port) > 65535) {
      throw new Error(`The port must be an integer from 0 to 65535, not ${values.port}.`);
    }
    port = Number(values.port);
  }
  return { name, configurationPath: values.config, port, https: values.https ?? false, verbose: values.verbose ?? false };
};
