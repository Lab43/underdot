// spec: docs/specs/dev-server.md, Serving

import type { Server } from 'node:net';

const firstPort = 3000;

const isAddressInUse = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'EADDRINUSE';

// One attempt, settled by whichever of listening and error fires first,
// with both listeners removed so an attempt leaves none behind.
const attempt = (server: Server, port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const onListening = (): void => {
      server.off('error', onError);
      resolve();
    };
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      reject(error);
    };
    server.once('listening', onListening);
    server.once('error', onError);
    server.listen(port);
  });

/**
 * Listen on the given port, which is taken or an error, or with none on
 * 3000 and then each next port until one is free. With no host given, the
 * server binds every interface. Resolves with the bound port.
 */
export const listen = async (server: Server, port: number | undefined): Promise<number> => {
  if (port === undefined) {
    let candidate = firstPort;
    for (;;) {
      try {
        await attempt(server, candidate);
        break;
      } catch (error) {
        if (!isAddressInUse(error)) {
          throw error;
        }
        candidate += 1;
      }
    }
  } else {
    await attempt(server, port);
  }
  const address = server.address();
  // Only a server bound to a pipe reports a string, and listen binds ports.
  /* v8 ignore next */
  if (address === null || typeof address === 'string') {
    throw new Error('The server is not bound to a port.');
  }
  return address.port;
};
