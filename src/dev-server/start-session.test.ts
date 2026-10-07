// spec: docs/specs/dev-server.md

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:https';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { describe, expect, vi } from 'vitest';
import { test as base } from '../../test/helpers/test.ts';
import { bindBuild } from '../build/bind-build.ts';
import { loadConfiguration } from '../configuration/load-configuration.ts';
import { startSession } from './start-session.ts';
import type { Session, SessionOptions } from './start-session.ts';

vi.mock('../build/bind-build.ts', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('node:os', { spy: true });

const loader = (directory: string) => () => loadConfiguration(join(directory, 'underdot.config.ts'));

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
  vi.waitFor(async () => {
    const response = await fetch(url);
    expect(response.status).toBe(200);
    return response.text();
  });

// bindBuild's next build replaced by one that settles when the test says.
const holdBuild = (): { release: () => void; fail: (error: Error) => void } => {
  let release = (): void => undefined;
  let fail = (_error: Error): void => undefined;
  const held = new Promise<void>((resolve, reject) => {
    release = resolve;
    fail = reject;
  });
  vi.mocked(bindBuild).mockReturnValueOnce(() => held);
  return { release, fail };
};

describe('startSession', () => {
  test.override({ fixture: 'dev' });

  test('serves the built site and prints the URLs and the build time', async ({ directory, start, stdout }) => {
    const { url } = await start();
    expect(url).toMatch(/^http:\/\/localhost:\d+\/$/);
    expect(await whenServed(url)).toBe(await readFile(join(directory, 'source/index.html'), 'utf8'));
    await vi.waitFor(() => {
      expect(stdout.at(-1)).toMatch(/^Built in \d+ ms\n$/);
    });
    const { port } = new URL(url);
    const address = Object.values(networkInterfaces())
      .flatMap((addresses) => addresses ?? [])
      .find((each) => each.family === 'IPv4' && !each.internal);
    const network = address === undefined ? [] : [`Network http://${address.address}:${port}/\n`];
    expect(stdout.slice(0, -1)).toStrictEqual([`Serving ${url}\n`, ...network]);
  });

  test('prints no network line when no interface is reachable', async ({ start, stdout }) => {
    vi.mocked(networkInterfaces).mockReturnValue({ none: undefined });
    const { url } = await start();
    await whenServed(url);
    expect(stdout.filter((line) => line.startsWith('Network'))).toStrictEqual([]);
  });

  // spec: docs/specs/dev-server.md, Session
  test('a site whose first build fails serves and prints the report', async ({ directory, start, stderr }) => {
    await mkdir(join(directory, 'source/_data'));
    await writeFile(join(directory, 'source/_data/bad.txt'), 'bad');
    const { url } = await start();
    await vi.waitFor(() => {
      expect(stderr).toStrictEqual(['The data file _data/bad.txt must be a .json, .js, or .ts file.\n']);
    });
    expect((await fetch(url)).status).toBe(404);
  });

  test('a loader that rejects fails the start', async () => {
    await expect(startSession({ load: () => Promise.reject(new Error('No configuration.')), port: 0 })).rejects.toThrow(
      new Error('No configuration.'),
    );
  });

  test('a busy explicit port fails the start', async ({ directory, start, stdout }) => {
    const { url } = await start();
    await expect(startSession({ load: loader(directory), port: Number(new URL(url).port) })).rejects.toMatchObject({ code: 'EADDRINUSE' });
    expect(stdout).toHaveLength(stdout.filter((line) => !line.startsWith('Built')).length + Number(stdout.at(-1)?.startsWith('Built') ?? false));
  });

  test('close without a build in flight returns', async ({ directory, stdout }) => {
    const session = await startSession({ load: loader(directory), port: 0 });
    await vi.waitFor(() => {
      expect(stdout.at(-1)).toMatch(/^Built in/);
    });
    await expect(session.close()).resolves.toBeUndefined();
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
      const { body } = await vi.waitFor(async () => {
        const got = await getInsecurely(url);
        expect(got.status).toBe(200);
        return got;
      });
      expect(body).toBe(await readFile(join(directory, 'source/index.html'), 'utf8'));
      expect(stdout[0]).toBe(`Serving ${url}\n`);
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

  describe('closed while the first build runs', () => {
    test('a build that then succeeds prints nothing', async ({ directory, stdout }) => {
      const { release } = holdBuild();
      const session = await startSession({ load: loader(directory), port: 0 });
      const closing = session.close();
      release();
      await closing;
      expect(stdout.filter((line) => line.startsWith('Built'))).toStrictEqual([]);
    });

    test('a build that then fails prints no report', async ({ directory, stderr, stdout }) => {
      const { fail } = holdBuild();
      const session = await startSession({ load: loader(directory), port: 0 });
      const closing = session.close();
      fail(new Error('Late failure.'));
      await closing;
      expect(stderr).toStrictEqual([]);
      expect(stdout.filter((line) => line.startsWith('Built'))).toStrictEqual([]);
    });
  });
});
