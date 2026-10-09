import { afterEach, describe, expect, vi } from 'vitest';
import { test } from '../../test/helpers/test.ts';
import { bindReporter } from './bind-reporter.ts';

describe('bindReporter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('serving writes each URL to standard output as a report of its own', ({ stdout, stderr }) => {
    bindReporter({ timestamps: false, verbose: false }).serving('http://localhost:8080/', 'http://192.168.1.4:8080/');
    expect(stdout).toStrictEqual(['Serving http://localhost:8080/\n', 'Network http://192.168.1.4:8080/\n']);
    expect(stderr).toStrictEqual([]);
  });

  test('serving without a network URL writes the one line', ({ stdout }) => {
    bindReporter({ timestamps: false, verbose: false }).serving('http://localhost:8080/', undefined);
    expect(stdout).toStrictEqual(['Serving http://localhost:8080/\n']);
  });

  // spec: docs/specs/dev-server.md, Terminal
  test('reloaded names the configuration file by its base name on standard output', ({ stdout, stderr }) => {
    bindReporter({ timestamps: false, verbose: false }).reloaded('/site/underdot.config.ts');
    expect(stdout).toStrictEqual(['Reloaded underdot.config.ts\n']);
    expect(stderr).toStrictEqual([]);
  });

  // spec: docs/specs/plugins.md, Errors
  test('warned writes the unit, the plugin, then the message to standard error', ({ stdout, stderr }) => {
    bindReporter({ timestamps: false, verbose: false }).warned('Handling styles/site.scss', 'sass', 'Deprecated.');
    expect(stderr).toStrictEqual(['! Handling styles/site.scss warned in sass: Deprecated.\n']);
    expect(stdout).toStrictEqual([]);
  });

  test('warned keeps the later lines of a message as they are, in one write', ({ stderr }) => {
    bindReporter({ timestamps: false, verbose: false }).warned('Handling styles/site.scss', 'sass', 'Deprecated.\n  site.scss 4:3  root stylesheet');
    expect(stderr).toStrictEqual(['! Handling styles/site.scss warned in sass: Deprecated.\n  site.scss 4:3  root stylesheet\n']);
  });

  test('failed writes the report to standard error with its first line marked', ({ stdout, stderr }) => {
    bindReporter({ timestamps: false, verbose: false }).failed('Rendering index.ejs failed.');
    expect(stderr).toStrictEqual(['✗ Rendering index.ejs failed.\n']);
    expect(stdout).toStrictEqual([]);
  });

  test('failed marks the first line of a report only, in one write', ({ stderr }) => {
    bindReporter({ timestamps: false, verbose: false }).failed('Unknown option --watch.\nUsage: underdot build');
    expect(stderr).toStrictEqual(['✗ Unknown option --watch.\nUsage: underdot build\n']);
  });

  test.for([
    [84, '84 ms'],
    [999.4, '999 ms'],
    [999.6, '1.0 s'],
    [1449, '1.4 s'],
  ] as const)('built after %d milliseconds writes %s to standard output', ([milliseconds, duration], { stdout }) => {
    bindReporter({ timestamps: false, verbose: false }).built(milliseconds, { ran: 420, reused: 0 });
    expect(stdout).toStrictEqual([`✓ Built in ${duration} · 420 ran\n`]);
  });

  // spec: docs/specs/build.md, Output
  test('built counts the units that ran and the units reused', ({ stdout }) => {
    bindReporter({ timestamps: false, verbose: false }).built(84, { ran: 3, reused: 417 });
    expect(stdout).toStrictEqual(['✓ Built in 84 ms · 3 ran, 417 reused\n']);
  });

  test('without verbose, the units that ran and the destination writes and removals print nothing', ({ stdout, stderr }) => {
    const reporter = bindReporter({ timestamps: false, verbose: false });
    reporter.ran('Rendered index.tpl', [{ kind: 'file', name: 'index.tpl', status: 'changed' }]);
    reporter.wrote('index.html');
    reporter.removed('old/');
    expect(stdout).toStrictEqual([]);
    expect(stderr).toStrictEqual([]);
  });

  // spec: docs/specs/build.md, Output
  describe('with verbose', () => {
    test('a unit that ran with no changed input prints its label', ({ stdout }) => {
      bindReporter({ timestamps: false, verbose: true }).ran('Handled styles/site.css', []);
      expect(stdout).toStrictEqual(['  Handled styles/site.css\n']);
    });

    test.for([
      [{ kind: 'file', name: 'about.tpl', status: 'changed' }, 'about.tpl changed'],
      [{ kind: 'file', name: '_data/site.json', status: 'added' }, '_data/site.json added'],
      [{ kind: 'output', name: 'notes.text', status: 'removed' }, 'output notes.text removed'],
      [{ kind: 'body', name: '/about/', status: 'changed' }, 'body of /about/ changed'],
      [{ kind: 'global', name: 'site', status: 'changed' }, 'global site changed'],
      [{ kind: 'globals', name: '', status: 'changed' }, 'globals changed'],
      [{ kind: 'chain', name: 'about.tpl', status: 'changed' }, 'template chain changed'],
      [{ kind: 'pages', name: '', status: 'changed' }, 'pages changed'],
      [{ kind: 'parameters', name: '', status: 'changed' }, 'parameters changed'],
    ] as const)('a change to %o reads as %s', ([change, reason], { stdout }) => {
      bindReporter({ timestamps: false, verbose: true }).ran('Rendered about.tpl', [change]);
      expect(stdout).toStrictEqual([`  Rendered about.tpl · ${reason}\n`]);
    });

    test('two changed inputs are joined', ({ stdout }) => {
      bindReporter({ timestamps: false, verbose: true }).ran('Rendered about.tpl', [
        { kind: 'file', name: 'about.tpl', status: 'changed' },
        { kind: 'global', name: 'site', status: 'changed' },
      ]);
      expect(stdout).toStrictEqual(['  Rendered about.tpl · about.tpl changed, global site changed\n']);
    });

    test('a write and a removal print their output paths', ({ stdout }) => {
      const reporter = bindReporter({ timestamps: false, verbose: true });
      reporter.wrote('about/index.html');
      reporter.removed('old/');
      expect(stdout).toStrictEqual(['  Wrote about/index.html\n', '  Removed old/\n']);
    });

    test('a reused unit prints nothing', ({ stdout }) => {
      bindReporter({ timestamps: false, verbose: true }).reused('Rendered about.tpl');
      expect(stdout).toStrictEqual([]);
    });
  });

  // spec: docs/specs/dev-server.md, Terminal
  test('with timestamps, the first line of a report starts with the local time and later lines do not', ({ stderr }) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 8, 9, 5, 3));
    bindReporter({ timestamps: true, verbose: false }).failed('Rendering index.ejs failed.\n  at line 3');
    expect(stderr).toStrictEqual(['09:05:03 ✗ Rendering index.ejs failed.\n  at line 3\n']);
  });

  test('with color forced, each kind of line carries its color', ({ stdout, stderr }) => {
    vi.stubEnv('FORCE_COLOR', '1');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 8, 21, 40, 0));
    const reporter = bindReporter({ timestamps: true, verbose: true });
    reporter.serving('http://localhost:8080/', 'http://192.168.1.4:8080/');
    reporter.reloaded('/site/underdot.config.ts');
    reporter.ran('Rendered about.tpl', [{ kind: 'file', name: 'about.tpl', status: 'changed' }]);
    reporter.built(84, { ran: 3, reused: 417 });
    reporter.warned('Handling styles/site.scss', 'sass', 'Deprecated.');
    reporter.failed('Rendering index.ejs failed.\n  at line 3');
    expect(stdout).toStrictEqual([
      '\u001b[2m21:40:00\u001b[22m Serving \u001b[36mhttp://localhost:8080/\u001b[39m\n',
      '\u001b[2m21:40:00\u001b[22m Network \u001b[36mhttp://192.168.1.4:8080/\u001b[39m\n',
      '\u001b[2m21:40:00\u001b[22m Reloaded underdot.config.ts\n',
      '\u001b[2m21:40:00\u001b[22m   Rendered about.tpl\u001b[2m · about.tpl changed\u001b[22m\n',
      '\u001b[2m21:40:00\u001b[22m \u001b[32m✓ Built in 84 ms\u001b[39m\u001b[2m · 3 ran, 417 reused\u001b[22m\n',
    ]);
    expect(stderr).toStrictEqual([
      '\u001b[2m21:40:00\u001b[22m \u001b[33m! Handling styles/site.scss warned in sass:\u001b[39m Deprecated.\n',
      '\u001b[2m21:40:00\u001b[22m \u001b[31m✗ Rendering index.ejs failed.\u001b[39m\n  at line 3\n',
    ]);
  });
});
