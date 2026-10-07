// spec: docs/specs/dev-server.md, Serving

import { createServer } from 'node:http';
import type { Server } from 'node:net';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { listen } from './listen.ts';

const servers: Server[] = [];

const server = (): Server => {
  const created = createServer();
  servers.push(created);
  return created;
};

const close = (closing: Server): Promise<void> =>
  new Promise((resolve) => {
    closing.close(() => {
      resolve();
    });
  });

afterEach(async () => {
  await Promise.all(servers.splice(0).filter((each) => each.listening).map(close));
});

describe('listen', () => {
  test('with no port, 3000 is skipped when busy and the next free port is taken', async () => {
    // Whether this occupation succeeds or 3000 was already busy, 3000 is busy.
    await listen(server(), 3000).catch(() => undefined);
    const port = await listen(server(), undefined);
    expect(port).toBeGreaterThan(3000);
  });

  test('port 0 binds a port the operating system chooses', async () => {
    const port = await listen(server(), 0);
    expect(port).toBeGreaterThan(0);
  });

  test('a busy port given explicitly is an error', async () => {
    const busy = await listen(server(), 0);
    await expect(listen(server(), busy)).rejects.toMatchObject({ code: 'EADDRINUSE' });
  });

  test('an error other than a busy address ends the search', async () => {
    const failing = server();
    const denied = Object.assign(new Error('listen EACCES'), { code: 'EACCES' });
    vi.spyOn(failing, 'listen').mockImplementation(() => {
      process.nextTick(() => failing.emit('error', denied));
      return failing;
    });
    const before = failing.listenerCount('listening');
    await expect(listen(failing, undefined)).rejects.toBe(denied);
    expect(failing.listenerCount('listening')).toBe(before);
  });

  test('an attempt leaves no listener behind', async () => {
    const listening = server();
    const errors = listening.listenerCount('error');
    const listenings = listening.listenerCount('listening');
    await listen(listening, 0);
    expect(listening.listenerCount('error')).toBe(errors);
    expect(listening.listenerCount('listening')).toBe(listenings);
  });
});
