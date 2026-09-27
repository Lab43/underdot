// spec: docs/specs/configuration.md, Commands

import { describe, expect, test } from 'vitest';
import { parseCommand } from './parse-command.ts';

describe('parseCommand', () => {
  test('build alone names the build with no configuration path', () => {
    expect(parseCommand(['build'])).toStrictEqual({ name: 'build', configurationPath: undefined });
  });

  test('--config is taken before or after the command, and as one argument', () => {
    const command = { name: 'build', configurationPath: 'x.ts' };
    expect(parseCommand(['build', '--config', 'x.ts'])).toStrictEqual(command);
    expect(parseCommand(['--config', 'x.ts', 'build'])).toStrictEqual(command);
    expect(parseCommand(['build', '--config=x.ts'])).toStrictEqual(command);
  });

  describe('usage errors', () => {
    test('no command', () => {
      expect(() => parseCommand([])).toThrow(new Error('No command given.'));
    });

    test('an unknown command', () => {
      expect(() => parseCommand(['serve'])).toThrow(new Error('Unknown command: serve.'));
    });

    test('a second positional', () => {
      expect(() => parseCommand(['build', 'extra'])).toThrow(new Error('Unexpected argument: extra.'));
    });

    test("an option missing its value carries the parser's message", () => {
      expect(() => parseCommand(['build', '--config'])).toThrow(
        expect.objectContaining({ message: "Option '--config <value>' argument missing" }),
      );
    });

    test("an unknown option carries the parser's message", () => {
      expect(() => parseCommand(['build', '--foo'])).toThrow(/^Unknown option '--foo'/);
    });
  });
});
