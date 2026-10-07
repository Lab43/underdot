// spec: docs/specs/dev-server.md

import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { Server as HttpsServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { bindBuild } from '../build/bind-build.ts';
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
}

/**
 * A running session: the URL it serves and the function that stops it.
 */
export interface Session {
  url: string;
  close: () => Promise<void>;
}

/**
 * Load the configuration, serve its destination, and run the first build,
 * printing the URLs and every build's outcome.
 */
export const startSession = async ({ load, port, https = false }: SessionOptions): Promise<Session> => {
  const configuration = await load();
  const site: Site = { destination: configuration.destination, rewrites: configuration.rewrites };
  const build = bindBuild(configuration);
  let closed = false;

  // The pair is read beside the configuration, so a session started with
  // --config reads the project's own.
  // spec: docs/specs/dev-server.md, Serving
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

  const handle = (request: IncomingMessage, response: ServerResponse): void => {
    void serveRequest(site, request, response);
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

  process.stdout.write(`Serving ${url}\n`);
  // The first address a device on the same network can reach.
  const networkAddress = Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .find((address) => address.family === 'IPv4' && !address.internal);
  if (networkAddress !== undefined) {
    process.stdout.write(`Network ${scheme}://${networkAddress.address}:${String(boundPort)}/\n`);
  }

  // One build's outcome, printed unless the session closed while it ran.
  // spec: docs/specs/dev-server.md, Build status
  const runBuild = async (): Promise<void> => {
    const started = performance.now();
    try {
      await build();
    } catch (error) {
      if (!closed) {
        process.stderr.write(`${describeError(error)}\n`);
      }
      return;
    }
    if (!closed) {
      process.stdout.write(`Built in ${String(Math.round(performance.now() - started))} ms\n`);
    }
  };
  const running = runBuild();

  // The build in flight is awaited so its last write lands before a caller
  // removes the directory.
  const close = async (): Promise<void> => {
    closed = true;
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
