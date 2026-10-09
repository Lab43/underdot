// spec: q-docs/specs/dev-server.md

import { watch } from 'node:fs';
import type { FSWatcher, WatchListener } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { Server as HttpsServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { bindBuild } from '../build/bind-build.ts';
import type { BuildCounts } from '../build/bind-build.ts';
import { bindReporter } from '../build/bind-reporter.ts';
import type { ResolvedConfiguration } from '../configuration/resolve-configuration.ts';
import { describeError } from '../shared/describe-error.ts';
import { hasErrorCode } from '../shared/has-error-code.ts';
import { listen } from './listen.ts';
import { serveRequest } from './serve-request.ts';
import type { Site } from './serve-request.ts';

/**
 * What a session starts with: the loader that yields its configuration, the
 * configuration file to watch when there is one, and the options the
 * command takes.
 */
export interface SessionOptions {
  load: () => Promise<ResolvedConfiguration>;
  configurationFile?: string;
  port?: number;
  https?: boolean;
  verbose?: boolean;
}

/**
 * A running session: the URL it serves and the function that stops it.
 */
export interface Session {
  url: string;
  close: () => Promise<void>;
}

/**
 * What a connecting browser is shown: nothing, that a build runs, or a report.
 */
type Status = { name: 'idle' } | { name: 'building' } | { name: 'failed'; report: string };

/**
 * The event stream's path, under an underscore segment no site output can have.
 */
const eventsPath = '/_underdot/events';

/**
 * Load the configuration, serve its destination, build it, and rebuild it on
 * every change until closed, printing the URLs and every build's outcome and
 * telling every connected browser how each build went.
 */
export const startSession = async ({ load, configurationFile, port, https = false, verbose = false }: SessionOptions): Promise<Session> => {
  const reporter = bindReporter({ timestamps: true, verbose });
  const configuration = await load();
  let site: Site = { destination: configuration.destination, rewrites: configuration.rewrites };
  let build = bindBuild(configuration, reporter);
  let sourceWatcher: FSWatcher;
  let configurationWatcher: FSWatcher | undefined;
  const streams = new Set<ServerResponse>();
  let status: Status = { name: 'idle' };
  let configurationError: string | undefined;
  let pending = false;
  // The configuration file its watcher saw change, reloaded before the next build.
  let changedConfigurationFile: string | undefined;
  let running: Promise<void> | undefined;
  let closed = false;
  // Read through a call, because close runs while a load or a build is
  // awaited and a read the narrowing has settled would not see it.
  const isClosed = (): boolean => closed;

  // The pair is read beside the configuration, so a session started with
  // --config reads the project's own.
  // spec: q-docs/specs/dev-server.md, Serving
  const readPair = async (name: string): Promise<Buffer> => {
    try {
      return await readFile(join(configuration.projectDirectory, name));
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        throw new Error(
          `No ${name} in ${configuration.projectDirectory}. Run \`mkcert localhost\` there to generate localhost.pem and localhost-key.pem.`,
          { cause: error },
        );
      }
      throw error;
    }
  };

  // One event to a stream: its name, one data line per line of the data,
  // and a blank line.
  // spec: q-docs/specs/dev-server.md, Build status
  const send = (stream: ServerResponse, name: string, data = ''): void => {
    const lines = data.split('\n').map((line) => `data: ${line}\n`).join('');
    stream.write(`event: ${name}\n${lines}\n`);
  };

  const broadcast = (name: string, data?: string): void => {
    for (const stream of streams) {
      send(stream, name, data);
    }
  };

  // The event stream is answered before anything else, so a site's catch-all
  // rewrite cannot swallow it, and a connecting client is told the status.
  // spec: q-docs/specs/dev-server.md, Live reload
  const handle = (request: IncomingMessage, response: ServerResponse): void => {
    if (request.url !== eventsPath) {
      void serveRequest(site, request, response);
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    response.flushHeaders();
    streams.add(response);
    response.on('close', () => {
      streams.delete(response);
    });
    if (status.name === 'building') {
      send(response, 'building');
    }
    if (status.name === 'failed') {
      send(response, 'failed', status.report);
    }
  };

  // A watcher's own error is printed, and the watcher keeps watching.
  // spec: q-docs/specs/dev-server.md, Watching
  const startWatcher = (path: string, options: { recursive?: boolean }, listener: WatchListener<string>): FSWatcher => {
    const watcher = watch(path, options, listener);
    watcher.on('error', (error) => {
      reporter.failed(describeError(error));
    });
    return watcher;
  };

  // The root is checked first, because a recursive watch on a missing
  // directory throws on macOS but starts and reports the error later on
  // Linux. Which file changed does not matter: the build's own
  // stat-and-hash pass decides what reruns, so any event schedules a build.
  const watchSource = async (source: string): Promise<FSWatcher> => {
    await stat(source);
    return startWatcher(source, { recursive: true }, () => {
      scheduleBuild();
    });
  };

  // Replace the site, the build, and the source watcher from a fresh load,
  // or keep the previous ones and report the failure, which stands until a
  // reload succeeds.
  // spec: q-docs/specs/dev-server.md, Session
  const reload = async (): Promise<boolean> => {
    let next: ResolvedConfiguration;
    let watcher: FSWatcher;
    try {
      next = await load();
      if (isClosed()) {
        return false;
      }
      watcher = await watchSource(next.source);
    } catch (error) {
      if (isClosed()) {
        return false;
      }
      configurationError = describeError(error);
      status = { name: 'failed', report: configurationError };
      reporter.failed(configurationError);
      broadcast('failed', configurationError);
      return false;
    }
    // A close during the root's stat has already closed the old watcher,
    // so the new one is closed here rather than kept.
    if (isClosed()) {
      watcher.close();
      return false;
    }
    sourceWatcher.close();
    sourceWatcher = watcher;
    site = { destination: next.destination, rewrites: next.rewrites };
    build = bindBuild(next, reporter);
    configurationError = undefined;
    return true;
  };

  // One build at a time, and one more after it when a change arrived while
  // it ran, however many arrived. A build that settles after the session
  // closed sets, prints, and broadcasts nothing.
  // spec: q-docs/specs/dev-server.md, Watching
  const runBuilds = async (): Promise<void> => {
    while (pending && !isClosed()) {
      pending = false;
      const reloadedFile = changedConfigurationFile;
      if (reloadedFile !== undefined) {
        changedConfigurationFile = undefined;
        if (!(await reload())) {
          continue;
        }
        reporter.reloaded(reloadedFile);
      }
      status = { name: 'building' };
      broadcast('building');
      const started = performance.now();
      let counts: BuildCounts;
      try {
        counts = await build();
      } catch (error) {
        if (isClosed()) {
          return;
        }
        const report = describeError(error);
        status = { name: 'failed', report };
        reporter.failed(report);
        broadcast('failed', report);
        continue;
      }
      if (isClosed()) {
        return;
      }
      // A standing configuration report outlasts a successful source build,
      // which ran under a configuration the author has already replaced.
      status = configurationError === undefined ? { name: 'idle' } : { name: 'failed', report: configurationError };
      reporter.built(performance.now() - started, counts);
      broadcast('built');
    }
  };

  const scheduleBuild = (): void => {
    if (isClosed()) {
      return;
    }
    pending = true;
    running ??= runBuilds().finally(() => {
      running = undefined;
    });
  };

  let server: HttpServer | HttpsServer;
  if (https) {
    const cert = await readPair('localhost.pem');
    const key = await readPair('localhost-key.pem');
    server = createHttpsServer({ cert, key }, handle);
  } else {
    server = createHttpServer(handle);
  }
  const boundPort = await listen(server, port);
  const scheme = https ? 'https' : 'http';
  const url = `${scheme}://localhost:${String(boundPort)}/`;

  // The configuration file is watched through its directory, because an
  // editor that saves by renaming a temporary file over it replaces the
  // inode a watch on the file would hold. The destination's writes arrive on
  // the same watcher, so only an event naming the file reloads. A failure
  // here leaves nothing open.
  // spec: q-docs/specs/dev-server.md, Watching
  try {
    if (configurationFile !== undefined) {
      configurationWatcher = startWatcher(dirname(configurationFile), {}, (_event, filename) => {
        if (filename === basename(configurationFile)) {
          changedConfigurationFile = configurationFile;
          scheduleBuild();
        }
      });
    }
    sourceWatcher = await watchSource(configuration.source);
  } catch (error) {
    configurationWatcher?.close();
    server.close();
    throw error;
  }

  // The first address a device on the same network can reach.
  const networkAddress = Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .find((address) => address.family === 'IPv4' && !address.internal);
  const networkUrl = networkAddress === undefined ? undefined : `${scheme}://${networkAddress.address}:${String(boundPort)}/`;
  reporter.serving(url, networkUrl);
  scheduleBuild();

  // The build in flight is awaited so its last write lands before a caller
  // removes the directory.
  const close = async (): Promise<void> => {
    closed = true;
    sourceWatcher.close();
    configurationWatcher?.close();
    for (const stream of streams) {
      stream.end();
    }
    server.closeAllConnections();
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    await running;
  };

  return { url, close };
};
