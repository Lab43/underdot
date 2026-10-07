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

  describe('dev', () => {
    test('dev alone names the session with no port and no HTTPS', () => {
      expect(parseCommand(['dev'])).toStrictEqual({ name: 'dev', configurationPath: undefined, port: undefined, https: false });
    });

    test('the port and the HTTPS option are taken', () => {
      expect(parseCommand(['dev', '--port', '4000', '--https'])).toStrictEqual({
        name: 'dev',
        configurationPath: undefined,
        port: 4000,
        https: true,
      });
    });

    test('--port is taken as a separate argument and as one', () => {
      expect(parseCommand(['dev', '--port', '4000'])).toMatchObject({ port: 4000 });
      expect(parseCommand(['dev', '--port=4000'])).toMatchObject({ port: 4000 });
    });

    test('port 0 is accepted', () => {
      expect(parseCommand(['dev', '--port', '0'])).toMatchObject({ port: 0 });
    });

    test.each(['abc', '70000', '1.5'])('--port %s is a usage error', (value) => {
      expect(() => parseCommand(['dev', '--port', value])).toThrow(
        new Error(`The port must be an integer from 0 to 65535, not ${value}.`),
      );
    });

    test('--https takes no value', () => {
      expect(() => parseCommand(['dev', '--https=false'])).toThrow(
        expect.objectContaining({ message: "Option '--https' does not take an argument" }),
      );
    });
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

    test.each([
      ['port', ['build', '--port', '1']],
      ['https', ['build', '--https']],
    ])('build given --%s is a usage error', (option, args) => {
      expect(() => parseCommand(args)).toThrow(new Error(`The --${option} option belongs to dev.`));
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
