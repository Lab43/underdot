import { afterEach, describe, expect, vi } from 'vitest';
import { test } from '../../test/helpers/test.ts';
import { bindReporter } from './bind-reporter.ts';

describe('bindReporter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('serving writes each URL to standard output as a report of its own', ({ stdout, stderr }) => {
    bindReporter({ timestamps: false }).serving('http://localhost:8080/', 'http://192.168.1.4:8080/');
    expect(stdout).toStrictEqual(['Serving http://localhost:8080/\n', 'Network http://192.168.1.4:8080/\n']);
    expect(stderr).toStrictEqual([]);
  });

  test('serving without a network URL writes the one line', ({ stdout }) => {
    bindReporter({ timestamps: false }).serving('http://localhost:8080/', undefined);
    expect(stdout).toStrictEqual(['Serving http://localhost:8080/\n']);
  });

  // spec: docs/specs/dev-server.md, Terminal
  test('reloaded names the configuration file by its base name on standard output', ({ stdout, stderr }) => {
    bindReporter({ timestamps: false }).reloaded('/site/underdot.config.ts');
    expect(stdout).toStrictEqual(['Reloaded underdot.config.ts\n']);
    expect(stderr).toStrictEqual([]);
  });

  // spec: docs/specs/plugins.md, Errors
  test('warned writes the unit, the plugin, then the message to standard error', ({ stdout, stderr }) => {
    bindReporter({ timestamps: false }).warned('Handling styles/site.scss', 'sass', 'Deprecated.');
    expect(stderr).toStrictEqual(['! Handling styles/site.scss warned in sass: Deprecated.\n']);
    expect(stdout).toStrictEqual([]);
  });

  test('warned keeps the later lines of a message as they are, in one write', ({ stderr }) => {
    bindReporter({ timestamps: false }).warned('Handling styles/site.scss', 'sass', 'Deprecated.\n  site.scss 4:3  root stylesheet');
    expect(stderr).toStrictEqual(['! Handling styles/site.scss warned in sass: Deprecated.\n  site.scss 4:3  root stylesheet\n']);
  });

  test('failed writes the report to standard error with its first line marked', ({ stdout, stderr }) => {
    bindReporter({ timestamps: false }).failed('Rendering index.ejs failed.');
    expect(stderr).toStrictEqual(['✗ Rendering index.ejs failed.\n']);
    expect(stdout).toStrictEqual([]);
  });

  test('failed marks the first line of a report only, in one write', ({ stderr }) => {
    bindReporter({ timestamps: false }).failed('Unknown option --watch.\nUsage: underdot build');
    expect(stderr).toStrictEqual(['✗ Unknown option --watch.\nUsage: underdot build\n']);
  });

  test.for([
    [84, '84 ms'],
    [999.4, '999 ms'],
    [999.6, '1.0 s'],
    [1449, '1.4 s'],
  ] as const)('built after %d milliseconds writes %s to standard output', ([milliseconds, duration], { stdout }) => {
    bindReporter({ timestamps: false }).built(milliseconds);
    expect(stdout).toStrictEqual([`✓ Built in ${duration}\n`]);
  });

  // spec: docs/specs/dev-server.md, Terminal
  test('with timestamps, the first line of a report starts with the local time and later lines do not', ({ stderr }) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 8, 9, 5, 3));
    bindReporter({ timestamps: true }).failed('Rendering index.ejs failed.\n  at line 3');
    expect(stderr).toStrictEqual(['09:05:03 ✗ Rendering index.ejs failed.\n  at line 3\n']);
  });

  test('with color forced, each kind of line carries its color', ({ stdout, stderr }) => {
    vi.stubEnv('FORCE_COLOR', '1');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 8, 21, 40, 0));
    const reporter = bindReporter({ timestamps: true });
    reporter.serving('http://localhost:8080/', 'http://192.168.1.4:8080/');
    reporter.reloaded('/site/underdot.config.ts');
    reporter.built(84);
    reporter.warned('Handling styles/site.scss', 'sass', 'Deprecated.');
    reporter.failed('Rendering index.ejs failed.\n  at line 3');
    expect(stdout).toStrictEqual([
      '\u001b[2m21:40:00\u001b[22m Serving \u001b[36mhttp://localhost:8080/\u001b[39m\n',
      '\u001b[2m21:40:00\u001b[22m Network \u001b[36mhttp://192.168.1.4:8080/\u001b[39m\n',
      '\u001b[2m21:40:00\u001b[22m Reloaded underdot.config.ts\n',
      '\u001b[2m21:40:00\u001b[22m \u001b[32m✓ Built in 84 ms\u001b[39m\n',
    ]);
    expect(stderr).toStrictEqual([
      '\u001b[2m21:40:00\u001b[22m \u001b[33m! Handling styles/site.scss warned in sass:\u001b[39m Deprecated.\n',
      '\u001b[2m21:40:00\u001b[22m \u001b[31m✗ Rendering index.ejs failed.\u001b[39m\n  at line 3\n',
    ]);
  });
});
