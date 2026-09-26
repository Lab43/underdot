// spec: docs/specs/configuration.md, Commands

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseCommand } from './parse-command.ts';

describe('parseCommand', () => {
  test('build alone names the build with no configuration path', () => {
    assert.deepEqual(parseCommand(['build']), { name: 'build', configurationPath: undefined });
  });

  test('--config is taken before or after the command, and as one argument', () => {
    const command = { name: 'build', configurationPath: 'x.ts' };
    assert.deepEqual(parseCommand(['build', '--config', 'x.ts']), command);
    assert.deepEqual(parseCommand(['--config', 'x.ts', 'build']), command);
    assert.deepEqual(parseCommand(['build', '--config=x.ts']), command);
  });

  describe('usage errors', () => {
    test('no command', () => {
      assert.throws(() => parseCommand([]), { message: 'No command given.' });
    });

    test('an unknown command', () => {
      assert.throws(() => parseCommand(['serve']), { message: 'Unknown command: serve.' });
    });

    test('a second positional', () => {
      assert.throws(() => parseCommand(['build', 'extra']), { message: 'Unexpected argument: extra.' });
    });

    test("an option missing its value carries the parser's message", () => {
      assert.throws(() => parseCommand(['build', '--config']), { message: "Option '--config <value>' argument missing" });
    });

    test("an unknown option carries the parser's message", () => {
      assert.throws(() => parseCommand(['build', '--foo']), { message: /^Unknown option '--foo'/ });
    });
  });
});
