// spec: docs/specs/dev-server.md

import { EventEmitter } from 'node:events';
import { watch } from 'node:fs';
import type * as fs from 'node:fs';
import type { Stats } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import type * as fsPromises from 'node:fs/promises';
import { createServer } from 'node:http';
import { get } from 'node:https';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';
import { test as base } from '../../test/helpers/test.ts';
import { bindBuild } from '../build/bind-build.ts';
import type { BuildCounts } from '../build/bind-build.ts';
import { loadConfiguration } from '../configuration/load-configuration.ts';
import type { ResolvedConfiguration } from '../configuration/resolve-configuration.ts';
import { injectClientScript } from './inject-client-script.ts';
import { startSession } from './start-session.ts';
import type { Session, SessionOptions } from './start-session.ts';

vi.mock('../build/bind-build.ts', { spy: true });
// Spying on the whole of node:fs sends the worker's stdout writes to its
// stderr, so only watch is wrapped.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, watch: vi.fn(actual.watch) };
});
vi.mock('node:fs/promises', { spy: true });
vi.mock('node:os', { spy: true });

const { stat: realStat } = await vi.importActual<typeof fsPromises>('node:fs/promises');

interface Event {
  name: string;
  data: string;
}

// Longer than vi.waitFor's default second, which a first build can outlast on
// a busy CI runner, and shorter than the test's own five-second timeout.
const waitFor = <T>(callback: () => T | Promise<T>): Promise<T> => vi.waitFor(callback, { timeout: 3_000 });

// The captured writes without the time each report starts with.
const untimed = (writes: string[]): string[] => writes.map((write) => write.replace(/^\d\d:\d\d:\d\d /, ''));

// Replace the configuration in one step, as an editor's save does, so the
// watcher never loads it half written.
const replaceConfiguration = async (file: string, text: string): Promise<void> => {
  await writeFile(`${file}.tmp`, text);
  await rename(`${file}.tmp`, file);
};

const loader = (directory: string) => () => loadConfiguration(join(directory, 'underdot.config.ts'));

// A loader that imports the file as it stands on each call.
const reloader = (directory: string): (() => ReturnType<typeof loadConfiguration>) => {
  let version = 0;
  return () => loadConfiguration(join(directory, 'underdot.config.ts'), String(version++));
};

// Sessions on the copy, each closed before the copy is removed. Fixtures
// are torn down before onTestFinished runs, so a session closed there
// would outlive its directory.
const test = base.extend<{ start: (options?: Partial<SessionOptions>) => Promise<Session> }>({
  start: async ({ directory }, use) => {
    const open: Session[] = [];
    await use(async (options = {}) => {
      const session = await startSession({ load: loader(directory), port: 0, ...options });
      open.push(session);
      return session;
    });
    await Promise.all(open.map((session) => session.close()));
  },
});

// The page at the URL once the session serves it.
const whenServed = (url: string): Promise<string> =>
  waitFor(async () => {
    const response = await fetch(url);
    expect(response.status).toBe(200);
    return response.text();
  });

// The events the session's stream sends, collected as they arrive.
const subscribe = async (url: string): Promise<Event[]> => {
  const response = await fetch(`${url}_underdot/events`);
  expect(response.headers.get('content-type')).toBe('text/event-stream');
  expect(response.headers.get('cache-control')).toBe('no-store');
  const events: Event[] = [];
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const read = async (): Promise<void> => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      let end = buffer.indexOf('\n\n');
      while (end !== -1) {
        const lines = buffer.slice(0, end).split('\n');
        buffer = buffer.slice(end + 2);
        events.push({
          name: lines.filter((line) => line.startsWith('event: ')).map((line) => line.slice(7)).join(''),
          data: lines.filter((line) => line.startsWith('data: ')).map((line) => line.slice(6)).join('\n'),
        });
        end = buffer.indexOf('\n\n');
      }
    }
  };
  void read().catch(() => undefined);
  return events;
};

const names = (events: Event[]): string[] => events.map((event) => event.name);

// Until the stream's last event is the named one.
const whenLast = (events: Event[], name: string): Promise<Event> =>
  waitFor(() => {
    const last = events.at(-1);
    expect(last?.name).toBe(name);
    return last!;
  });

// bindBuild's next build replaced by one that settles when the test says,
// counting its calls.
const holdBuild = (): { build: ReturnType<typeof vi.fn>; release: () => void; fail: (error: Error) => void } => {
  let release = (): void => undefined;
  let fail = (_error: Error): void => undefined;
  const held = new Promise<BuildCounts>((resolve, reject) => {
    release = () => {
      resolve({ ran: 0, reused: 0 });
    };
    fail = reject;
  });
  const build = vi.fn(() => held);
  vi.mocked(bindBuild).mockReturnValueOnce(build);
  return { build, release, fail };
};

// A watcher the test drives, in place of the next one the session starts.
class FakeWatcher extends EventEmitter {
  close = vi.fn();
  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }
}

const driveNextWatcher = (): FakeWatcher => {
  const fake = new FakeWatcher();
  vi.mocked(watch).mockImplementationOnce((...args: unknown[]) => {
    // As fs.watch does, the listener given becomes a change listener.
    const listener = args.at(-1);
    if (typeof listener === 'function') {
      fake.on('change', (...eventArgs: unknown[]) => {
        listener(...eventArgs);
      });
    }
    return fake;
  });
  return fake;
};

const badDataReport = 'The data file _data/bad.txt must be a .json, .js, or .ts file.';

describe('startSession', () => {
  test.override({ fixture: 'dev' });

  test('serves the built site and prints the URLs and the build time', async ({ directory, start, stdout }) => {
    const { url } = await start();
    expect(url).toMatch(/^http:\/\/localhost:\d+\/$/);
    expect(await whenServed(url)).toBe(injectClientScript(await readFile(join(directory, 'source/index.html'), 'utf8')));
    await waitFor(() => {
      expect(untimed(stdout).at(-1)).toMatch(/^✓ Built in \d+(?: ms|\.\d s) · \d+ ran(?:, \d+ reused)?\n$/);
    });
    const { port } = new URL(url);
    const address = Object.values(networkInterfaces())
      .flatMap((addresses) => addresses ?? [])
      .find((each) => each.family === 'IPv4' && !each.internal);
    const network = address === undefined ? [] : [`Network http://${address.address}:${port}/\n`];
    // A late watcher event can start a second build, which prints a second line.
    expect(untimed(stdout).filter((line) => !line.startsWith('✓ Built'))).toStrictEqual([`Serving ${url}\n`, ...network]);
  });

  // spec: docs/specs/dev-server.md, Terminal
  test('starts each report with the local time', async ({ start, stdout }) => {
    const { url } = await start();
    await whenServed(url);
    expect(stdout[0]).toMatch(/^\d\d:\d\d:\d\d Serving /);
  });

  test('prints no network line when no interface is reachable', async ({ start, stdout }) => {
    vi.mocked(networkInterfaces).mockReturnValue({ none: undefined });
    const { url } = await start();
    await whenServed(url);
    expect(untimed(stdout).filter((line) => line.startsWith('Network'))).toStrictEqual([]);
  });

  // spec: docs/specs/dev-server.md, Session
  test('a site whose first build fails serves, prints the report, and builds once the fix lands', async ({ directory, start, stderr }) => {
    await mkdir(join(directory, 'source/_data'));
    await writeFile(join(directory, 'source/_data/bad.txt'), 'bad');
    const { url } = await start();
    await waitFor(() => {
      expect(untimed(stderr)).toContain(`✗ ${badDataReport}\n`);
    });
    // One write can start more than one build, and each prints the report.
    expect(new Set(untimed(stderr))).toStrictEqual(new Set([`✗ ${badDataReport}\n`]));
    expect((await fetch(url)).status).toBe(404);
    const events = await subscribe(url);
    await whenLast(events, 'failed');
    await rm(join(directory, 'source/_data/bad.txt'));
    await whenLast(events, 'built');
    expect((await fetch(url)).status).toBe(200);
  });

  test('a loader that rejects fails the start', async () => {
    await expect(startSession({ load: () => Promise.reject(new Error('No configuration.')), port: 0 })).rejects.toThrow(
      new Error('No configuration.'),
    );
  });

  test('a busy explicit port fails the start', async ({ directory, start, stdout }) => {
    const { url } = await start();
    await expect(startSession({ load: loader(directory), port: Number(new URL(url).port) })).rejects.toMatchObject({ code: 'EADDRINUSE' });
    expect(untimed(stdout).filter((line) => line.startsWith('Serving'))).toHaveLength(1);
  });

  test('close without a build in flight returns', async ({ directory, stdout }) => {
    const session = await startSession({ load: loader(directory), port: 0 });
    await waitFor(() => {
      expect(untimed(stdout).at(-1)).toMatch(/^✓ Built in/);
    });
    await expect(session.close()).resolves.toBeUndefined();
  });

  // spec: docs/specs/dev-server.md, Watching
  describe('a missing source root', () => {
    test('fails the start and frees the port', async ({ directory }) => {
      const file = join(directory, 'underdot.config.ts');
      await writeFile(file, "export default { source: 'missing' };\n");
      const probe = createServer();
      await new Promise<void>((resolve) => {
        probe.listen(0, resolve);
      });
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      await new Promise((resolve) => {
        probe.close(resolve);
      });
      await expect(startSession({ load: loader(directory), configurationFile: file, port })).rejects.toThrow(/ENOENT/);
      const again = createServer();
      await new Promise<void>((resolve) => {
        again.listen(port, resolve);
      });
      await new Promise((resolve) => {
        again.close(resolve);
      });
    });

    test('fails the start without a configuration file to watch', async ({ directory }) => {
      await writeFile(join(directory, 'underdot.config.ts'), "export default { source: 'missing' };\n");
      await expect(startSession({ load: loader(directory), port: 0 })).rejects.toThrow(/ENOENT/);
    });
  });

  // spec: docs/specs/dev-server.md, Build status
  describe('a source change', () => {
    test('rebuilds, serves the edit, and tells the browsers', async ({ directory, start }) => {
      const { url } = await start();
      await whenServed(url);
      const events = await subscribe(url);
      await writeFile(join(directory, 'source/index.html'), '<body><h1>Edited</h1></body>\n');
      await waitFor(async () => {
        expect(await (await fetch(url)).text()).toContain('Edited');
      });
      await whenLast(events, 'built');
      expect(names(events)).toContain('building');
      expect(new Set(names(events))).toStrictEqual(new Set(['building', 'built']));
    });

    // spec: docs/specs/build.md, Output
    test('with verbose, an edit prints the units that reran for it before the next Built line', async ({ directory, start, stdout }) => {
      const { url } = await start({ verbose: true });
      await whenServed(url);
      await waitFor(() => {
        expect(untimed(stdout).at(-1)).toMatch(/^✓ Built in/);
      });
      const before = stdout.length;
      await writeFile(join(directory, 'source/index.html'), '<body><h1>Edited</h1></body>\n');
      // A late event from the first build can print a Built line before the edit's.
      await waitFor(() => {
        const lines = untimed(stdout.slice(before));
        const handled = lines.indexOf('  Handled index.html · index.html changed\n');
        expect(lines.slice(handled, handled + 3)).toStrictEqual([
          '  Handled index.html · index.html changed\n',
          '  Wrote index.html\n',
          expect.stringMatching(/^✓ Built in .* · 1 ran, \d+ reused\n$/),
        ]);
      });
    });

    test('a failing build reports to the browsers and to a browser connecting later, until the fix builds', async ({ directory, start, stderr }) => {
      const { url } = await start();
      await whenServed(url);
      const events = await subscribe(url);
      await mkdir(join(directory, 'source/_data'));
      await writeFile(join(directory, 'source/_data/bad.txt'), 'bad');
      expect(await whenLast(events, 'failed')).toStrictEqual({ name: 'failed', data: badDataReport });
      expect(untimed(stderr)).toContain(`✗ ${badDataReport}\n`);
      expect((await fetch(url)).status).toBe(200);
      // A second event from the same save may have a build running on
      // connect, which sends building first.
      const later = await subscribe(url);
      await waitFor(() => {
        expect(later.find((event) => event.name !== 'building')).toStrictEqual({ name: 'failed', data: badDataReport });
      });
      await rm(join(directory, 'source/_data/bad.txt'));
      await whenLast(events, 'built');
      await whenLast(later, 'built');
    });
  });

  // spec: docs/specs/dev-server.md, Session
  describe('a configuration change', () => {
    test('reloads the configuration and builds in full', async ({ directory, start }) => {
      const file = join(directory, 'underdot.config.ts');
      const { url } = await start({ load: reloader(directory), configurationFile: file });
      await whenServed(url);
      const events = await subscribe(url);
      await replaceConfiguration(file, "export default { rewrites: { '/cart': '/about/' } };\n");
      await waitFor(async () => {
        expect(await (await fetch(`${url}cart`)).text()).toContain('About');
      });
      await whenLast(events, 'built');
      // Linux reports one save as more than one event, so a second reload may follow.
      expect(vi.mocked(bindBuild).mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    // spec: docs/specs/dev-server.md, Terminal
    test('a reload prints the configuration file before the build it starts', async ({ directory, start, stdout }) => {
      const file = join(directory, 'underdot.config.ts');
      const { url } = await start({ load: reloader(directory), configurationFile: file });
      await whenServed(url);
      await waitFor(() => {
        expect(untimed(stdout).at(-1)).toMatch(/^✓ Built in/);
      });
      const before = stdout.length;
      await replaceConfiguration(file, "export default { rewrites: { '/cart': '/about/' } };\n");
      // A late event from the first build can print a Built line before the reload's.
      await waitFor(() => {
        const lines = untimed(stdout.slice(before));
        const reloaded = lines.indexOf('Reloaded underdot.config.ts\n');
        expect(lines.slice(reloaded, reloaded + 2)).toStrictEqual(['Reloaded underdot.config.ts\n', expect.stringMatching(/^✓ Built in/)]);
      });
    });

    test('a configuration that fails to load is reported, stands through source builds, and clears when it loads', async ({ directory, start, stderr }) => {
      const file = join(directory, 'underdot.config.ts');
      const { url } = await start({ load: reloader(directory), configurationFile: file });
      await whenServed(url);
      const events = await subscribe(url);
      await replaceConfiguration(file, 'export default {\n');
      const failure = await whenLast(events, 'failed');
      expect(failure.data).not.toBe('');
      expect(untimed(stderr)).toContain(`✗ ${failure.data}\n`);
      expect(await (await fetch(`${url}cart`)).text()).toContain('Store');
      await writeFile(join(directory, 'source/index.html'), '<body><h1>Edited</h1></body>\n');
      await whenLast(events, 'built');
      // One save can reload more than once, and each report names the load's
      // version, so the one standing is the latest.
      const standing = events.findLast((event) => event.name === 'failed');
      const during = await subscribe(url);
      await waitFor(() => {
        expect(during.find((event) => event.name !== 'building')).toStrictEqual(standing);
      });
      await replaceConfiguration(file, 'export default {};\n');
      await whenLast(during, 'built');
      const after = await subscribe(url);
      await writeFile(join(directory, 'source/index.html'), '<body><h1>Edited again</h1></body>\n');
      await whenLast(after, 'built');
      expect(names(after)[0]).toBe('building');
      expect(names(after)).not.toContain('failed');
    });

    test('a session closed while the configuration loads starts no watcher and no build', async ({ directory, stdout }) => {
      const file = join(directory, 'underdot.config.ts');
      const load = vi.fn(reloader(directory));
      const session = await startSession({ load, configurationFile: file, port: 0 });
      await waitFor(() => {
        expect(untimed(stdout).at(-1)).toMatch(/^✓ Built in/);
      });
      // Every load from here is held, since a late watcher event can start
      // one before the save does, and only what follows the save is counted.
      let settle: (configuration: ResolvedConfiguration) => void = () => undefined;
      load.mockImplementation(() => new Promise((resolve) => {
        settle = resolve;
      }));
      const loads = load.mock.calls.length;
      const binds = vi.mocked(bindBuild).mock.calls.length;
      await replaceConfiguration(file, 'export default {};\n');
      await waitFor(() => {
        expect(load.mock.calls.length).toBeGreaterThan(loads);
      });
      const events = await subscribe(session.url);
      const watches = vi.mocked(watch).mock.calls.length;
      const built = untimed(stdout).filter((line) => line.startsWith('✓ Built')).length;
      const closing = session.close();
      settle(await loader(directory)());
      await closing;
      expect(vi.mocked(watch).mock.calls).toHaveLength(watches);
      expect(vi.mocked(bindBuild).mock.calls).toHaveLength(binds);
      expect(names(events)).toStrictEqual([]);
      expect(untimed(stdout).filter((line) => line.startsWith('✓ Built'))).toHaveLength(built);
    });

    test('a session closed while the new source root is checked closes the watcher it then starts', async ({ directory, stdout }) => {
      const file = join(directory, 'underdot.config.ts');
      const session = await startSession({ load: reloader(directory), configurationFile: file, port: 0 });
      await waitFor(() => {
        expect(untimed(stdout).at(-1)).toMatch(/^✓ Built in/);
      });
      // Only the source root's stat is held. A build a late watcher event
      // starts stats every source file through the same function.
      const source = join(directory, 'source');
      const sourceStats = await stat(source);
      let reached = false;
      let settle: (stats: Stats) => void = () => undefined;
      vi.mocked(stat).mockImplementation((path, options) => {
        if (path !== source) {
          return realStat(path, options);
        }
        return new Promise((resolve) => {
          reached = true;
          settle = resolve;
        });
      });
      const binds = vi.mocked(bindBuild).mock.calls.length;
      const fake = driveNextWatcher();
      await replaceConfiguration(file, 'export default {};\n');
      await waitFor(() => {
        expect(reached).toBe(true);
      });
      const closing = session.close();
      settle(sourceStats);
      await closing;
      expect(fake.close).toHaveBeenCalledOnce();
      expect(vi.mocked(bindBuild).mock.calls).toHaveLength(binds);
    });

    test('a session closed while the configuration loads prints no report when the load fails', async ({ directory, stderr, stdout }) => {
      const file = join(directory, 'underdot.config.ts');
      const load = vi.fn(reloader(directory));
      const session = await startSession({ load, configurationFile: file, port: 0 });
      await waitFor(() => {
        expect(untimed(stdout).at(-1)).toMatch(/^✓ Built in/);
      });
      // Every load from here is held, as in the test above.
      let fail: (error: Error) => void = () => undefined;
      load.mockImplementation(() => new Promise((_resolve, reject) => {
        fail = reject;
      }));
      const loads = load.mock.calls.length;
      await replaceConfiguration(file, 'export default {};\n');
      await waitFor(() => {
        expect(load.mock.calls.length).toBeGreaterThan(loads);
      });
      const events = await subscribe(session.url);
      const closing = session.close();
      fail(new Error('Late failure.'));
      await closing;
      expect(stderr).toStrictEqual([]);
      expect(names(events)).toStrictEqual([]);
    });

    test('a configuration naming a missing source root is reported and the site keeps serving', async ({ directory, start, stderr }) => {
      const file = join(directory, 'underdot.config.ts');
      const { url } = await start({ load: reloader(directory), configurationFile: file });
      await whenServed(url);
      const events = await subscribe(url);
      await replaceConfiguration(file, "export default { source: 'missing' };\n");
      const failure = await whenLast(events, 'failed');
      expect(failure.data).toMatch(/ENOENT/);
      expect(untimed(stderr)).toContain(`✗ ${failure.data}\n`);
      expect((await fetch(url)).status).toBe(200);
    });
  });

  // spec: docs/specs/dev-server.md, Watching
  describe('with a driven watcher', () => {
    test("a watcher's error is printed and the site keeps serving", async ({ start, stderr }) => {
      const fake = driveNextWatcher();
      const { url } = await start();
      await whenServed(url);
      fake.emit('error', new Error('The watcher broke.'));
      await waitFor(() => {
        expect(untimed(stderr)).toContain('✗ The watcher broke.\n');
      });
      expect((await fetch(url)).status).toBe(200);
    });

    test('an event without a filename on the configuration watcher reloads nothing', async ({ directory, start, stdout }) => {
      const load = vi.fn(loader(directory));
      const file = join(directory, 'underdot.config.ts');
      const fake = driveNextWatcher();
      const { url } = await start({ load, configurationFile: file });
      await whenServed(url);
      fake.emit('change', 'rename', null);
      await writeFile(join(directory, 'source/index.html'), '<body><h1>Edited</h1></body>\n');
      await waitFor(() => {
        expect(untimed(stdout).filter((line) => line.startsWith('✓ Built')).length).toBeGreaterThanOrEqual(2);
      });
      expect(load).toHaveBeenCalledTimes(1);
    });

    test("an event naming another file in the configuration's directory reloads nothing", async ({ directory, start, stdout }) => {
      const load = vi.fn(loader(directory));
      const file = join(directory, 'underdot.config.ts');
      const fake = driveNextWatcher();
      const { url } = await start({ load, configurationFile: file });
      await whenServed(url);
      fake.emit('change', 'rename', 'build');
      await writeFile(join(directory, 'source/index.html'), '<body><h1>Edited</h1></body>\n');
      await waitFor(() => {
        expect(untimed(stdout).filter((line) => line.startsWith('✓ Built')).length).toBeGreaterThanOrEqual(2);
      });
      expect(load).toHaveBeenCalledTimes(1);
    });
  });

  // spec: docs/specs/dev-server.md, Watching
  describe('with the first build held', () => {
    test('changes during a build are held into one build after it', async ({ start }) => {
      const { build, release } = holdBuild();
      const fake = driveNextWatcher();
      const { url } = await start();
      const events = await subscribe(url);
      await waitFor(() => {
        expect(events[0]).toStrictEqual({ name: 'building', data: '' });
      });
      fake.emit('change', 'rename', 'a.html');
      fake.emit('change', 'rename', 'b.html');
      fake.emit('change', 'rename', 'c.html');
      release();
      await waitFor(() => {
        expect(names(events).filter((name) => name === 'built')).toHaveLength(2);
      });
      expect(build).toHaveBeenCalledTimes(2);
      expect(names(events)).toStrictEqual(['building', 'built', 'building', 'built']);
    });

    test('a session closed mid-build prints and broadcasts nothing when the build settles, and builds no more', async ({ directory, stdout }) => {
      const { build, release } = holdBuild();
      const fake = driveNextWatcher();
      const session = await startSession({ load: loader(directory), port: 0 });
      const events = await subscribe(session.url);
      const closing = session.close();
      release();
      await closing;
      fake.emit('change', 'rename', 'a.html');
      expect(untimed(stdout).filter((line) => line.startsWith('✓ Built'))).toStrictEqual([]);
      expect(names(events)).not.toContain('built');
      expect(build).toHaveBeenCalledTimes(1);
    });

    test('a session closed mid-build prints no report when the build fails', async ({ directory, stderr, stdout }) => {
      const { fail } = holdBuild();
      const session = await startSession({ load: loader(directory), port: 0 });
      const closing = session.close();
      fail(new Error('Late failure.'));
      await closing;
      expect(stderr).toStrictEqual([]);
      expect(untimed(stdout).filter((line) => line.startsWith('✓ Built'))).toStrictEqual([]);
    });
  });

  // spec: docs/specs/dev-server.md, Serving
  describe('HTTPS', () => {
    // A GET that trusts the fixture's throwaway certificate.
    const getInsecurely = (url: string): Promise<{ status: number | undefined; body: string }> =>
      new Promise((resolve, reject) => {
        get(url, { rejectUnauthorized: false }, (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => {
            body += chunk;
          });
          response.on('end', () => {
            resolve({ status: response.statusCode, body });
          });
        }).on('error', reject);
      });

    test('serves from the pair in the project directory', async ({ directory, start, stdout }) => {
      const { url } = await start({ https: true });
      expect(url).toMatch(/^https:\/\/localhost:\d+\/$/);
      const { body } = await waitFor(async () => {
        const got = await getInsecurely(url);
        expect(got.status).toBe(200);
        return got;
      });
      expect(body).toBe(injectClientScript(await readFile(join(directory, 'source/index.html'), 'utf8')));
      expect(untimed(stdout)[0]).toBe(`Serving ${url}\n`);
    });

    test('a missing key names the key', async ({ directory }) => {
      await rm(join(directory, 'localhost-key.pem'));
      await expect(startSession({ load: loader(directory), port: 0, https: true })).rejects.toThrow(
        new Error(`No localhost-key.pem in ${directory}. Run \`mkcert localhost\` there to generate localhost.pem and localhost-key.pem.`),
      );
    });

    test('a read failure other than a missing file propagates', async ({ directory }) => {
      const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      vi.mocked(readFile).mockRejectedValueOnce(denied);
      await expect(startSession({ load: loader(directory), port: 0, https: true })).rejects.toBe(denied);
    });

    describe('in the defaults fixture', () => {
      test.override({ fixture: 'defaults' });

      test('a site without the pair names the certificate and mkcert', async ({ directory }) => {
        await expect(startSession({ load: loader(directory), port: 0, https: true })).rejects.toThrow(
          new Error(`No localhost.pem in ${directory}. Run \`mkcert localhost\` there to generate localhost.pem and localhost-key.pem.`),
        );
      });
    });
  });
});
