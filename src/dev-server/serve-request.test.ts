// spec: docs/specs/dev-server.md, Serving

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { injectClientScript } from './inject-client-script.ts';
import { serveRequest } from './serve-request.ts';
import type { Site } from './serve-request.ts';

vi.mock('node:fs/promises', { spy: true });

const html = 'text/html; charset=utf-8';
const plain = 'text/plain; charset=utf-8';

// A server on a port of its own, serving the site in place, for a suite's duration.
const serve = (site: Site, prepare?: (url: string | undefined) => string | undefined): (() => string) => {
  let server: Server;
  let url: string;
  beforeAll(async () => {
    server = createServer((request, response) => {
      if (prepare !== undefined) {
        request.url = prepare(request.url);
      }
      void serveRequest(site, request, response);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });
    const address = server.address();
    url = typeof address === 'object' && address !== null ? `http://localhost:${address.port}` : '';
  });
  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });
  return () => url;
};

const get = (url: string): Promise<Response> => fetch(url, { redirect: 'manual' });

describe('serveRequest', () => {
  describe('the dev fixture', () => {
    const source = fixturePath('dev/source');
    const url = serve({ destination: source, rewrites: { '/cart': '/store/', '/cart/**': '/store/' } });

    test('the root serves index.html with the script and the three headers', async () => {
      const response = await get(`${url()}/`);
      const body = await response.text();
      expect(response.status).toBe(200);
      expect(body).toBe(injectClientScript(await readFile(join(source, 'index.html'), 'utf8')));
      expect(response.headers.get('content-type')).toBe(html);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('content-length')).toBe(String(Buffer.byteLength(body)));
    });

    test('a page without a body tag gets the script appended', async () => {
      const response = await get(`${url()}/snippet.html`);
      expect(await response.text()).toBe(injectClientScript('<p>Snippet</p>\n'));
    });

    test('a directory without a trailing slash redirects to it, keeping the query', async () => {
      const bare = await get(`${url()}/about`);
      expect(bare.status).toBe(302);
      expect(bare.headers.get('location')).toBe('/about/');
      expect(bare.headers.get('cache-control')).toBe('no-store');
      const withQuery = await get(`${url()}/about?x=1`);
      expect(withQuery.headers.get('location')).toBe('/about/?x=1');
    });

    test('a redirect never starts with two slashes', async () => {
      const response = await get(`${url()}//about`);
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/about/');
    });

    test('a directory with a trailing slash serves its index, a doubled slash included', async () => {
      const about = await readFile(join(source, 'about/index.html'), 'utf8');
      expect(await (await get(`${url()}/about/`)).text()).toBe(injectClientScript(about));
      expect(await (await get(`${url()}//about/`)).text()).toBe(injectClientScript(about));
    });

    test('a percent-encoded path is decoded to find the file and kept raw in the redirect', async () => {
      const redirect = await get(`${url()}/caf%C3%A9`);
      expect(redirect.status).toBe(302);
      expect(redirect.headers.get('location')).toBe('/caf%C3%A9/');
      const page = await get(`${url()}/caf%C3%A9/`);
      expect(await page.text()).toBe(injectClientScript(await readFile(join(source, 'café/index.html'), 'utf8')));
    });

    test('a read that fails after the file was found is a 500 with the message', async () => {
      vi.mocked(readFile).mockRejectedValueOnce(new Error('The file vanished.'));
      const response = await get(`${url()}/`);
      expect(response.status).toBe(500);
      expect(response.headers.get('content-type')).toBe(plain);
      expect(await response.text()).toBe('The file vanished.');
    });

    test('a stylesheet carries its type with the charset', async () => {
      const response = await get(`${url()}/styles/site.css`);
      expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8');
    });

    test('a file with no known type is an octet stream', async () => {
      const response = await get(`${url()}/.htaccess`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/octet-stream');
    });

    test('a rewrite serves its path in place of the request', async () => {
      const store = await readFile(join(source, 'store/index.html'), 'utf8');
      expect(await (await get(`${url()}/cart`)).text()).toBe(injectClientScript(store));
      expect(await (await get(`${url()}/cart/anything`)).text()).toBe(injectClientScript(store));
    });

    test("a miss is the site's 404 page with the script and status 404", async () => {
      const response = await get(`${url()}/nope`);
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toBe(html);
      expect(await response.text()).toBe(injectClientScript(await readFile(join(source, '404.html'), 'utf8')));
    });

    test('a directory without an index is a miss', async () => {
      expect((await get(`${url()}/styles/`)).status).toBe(404);
    });

    test('a path that fails to decode is a miss', async () => {
      const response = await get(`${url()}/%E0%A4%A`);
      expect(response.status).toBe(404);
    });

    test('an encoded traversal stays inside the destination', async () => {
      const response = await get(`${url()}/..%2Funderdot.config.ts`);
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain('rewrites');
    });

    test('the event stream path is a miss here', async () => {
      expect((await get(`${url()}/_underdot/events`)).status).toBe(404);
    });
  });

  describe('a request whose target was cleared', () => {
    const url = serve({ destination: fixturePath('dev/source'), rewrites: {} }, () => undefined);

    test('is the root', async () => {
      const response = await get(`${url()}/anything`);
      expect(await response.text()).toBe(injectClientScript(await readFile(fixturePath('dev/source/index.html'), 'utf8')));
    });
  });

  describe('a built site', () => {
    const expected = fixturePath('templated/expected');
    const url = serve({ destination: expected, rewrites: {} });

    test('serves its pages', async () => {
      const response = await get(`${url()}/blog/hello/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(injectClientScript(await readFile(join(expected, 'blog/hello/index.html'), 'utf8')));
    });
  });

  describe('a site without a 404 page', () => {
    const url = serve({ destination: fixturePath('defaults/source'), rewrites: {} });

    test('answers a miss with plain text', async () => {
      const response = await get(`${url()}/nope`);
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toBe(plain);
      expect(await response.text()).toBe('Not found');
    });
  });
});
