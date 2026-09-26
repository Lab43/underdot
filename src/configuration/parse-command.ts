// spec: docs/specs/configuration.md, Commands

import { parseArgs } from 'node:util';

export interface Command {
  name: 'build';
  configurationPath: string | undefined;
}

// The command a command line names, or a thrown usage error whose message
// is the reason. The parser's own errors say what is wrong, so they propagate.
export const parseCommand = (args: string[]): Command => {
  const { positionals, values } = parseArgs({ args, options: { config: { type: 'string' } }, allowPositionals: true, strict: true });
  const [name, extra] = positionals;
  if (name === undefined) {
    throw new Error('No command given.');
  }
  if (name !== 'build') {
    throw new Error(`Unknown command: ${name}.`);
  }
  if (extra !== undefined) {
    throw new Error(`Unexpected argument: ${extra}.`);
  }
  return { name, configurationPath: values.config };
};
