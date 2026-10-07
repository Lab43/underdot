// spec: docs/specs/dev-server.md, Serving

import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, posix } from 'node:path';
import { contentType } from 'mime-types';
import { describeError } from '../shared/describe-error.ts';
import { matchGlob } from '../shared/match-glob.ts';
import { injectClientScript } from './inject-client-script.ts';

/**
 * The site a session serves: the destination its files are read from, and
 * the rewrites applied to a request before a file is looked for.
 */
export interface Site {
  destination: string;
  rewrites: Record<string, string>;
}

interface Answer {
  status: number;
  headers: Record<string, string>;
  body: Buffer | string;
}

const text = { 'Content-Type': 'text/plain; charset=utf-8' };

/**
 * Answer one request from the site. Never rejects: a failure after the file
 * was found is answered with status 500, since a rebuild races requests
 * exactly when the author is looking.
 */
export const serveRequest = async ({ destination, rewrites }: Site, request: IncomingMessage, response: ServerResponse): Promise<void> => {
  // The target is split by hand. Parsed as a URL, a target starting with
  // two slashes would lose its first segment to a host.
  const target = request.url ?? '/';
  const queryStart = target.indexOf('?');
  const rawPath = queryStart === -1 ? target : target.slice(0, queryStart);
  const query = queryStart === -1 ? '' : target.slice(queryStart);

  // A file is read whole and typed by its extension, with the charset
  // mime-types adds to every text type. HTML is decoded as text so the
  // script can be inserted, as UTF-8 because that is what the build writes.
  // spec: docs/specs/dev-server.md, Live reload
  const readAnswer = async (status: number, file: string): Promise<Answer> => {
    const type = contentType(extname(file));
    if (type !== false && type.startsWith('text/html')) {
      return { status, headers: { 'Content-Type': type }, body: injectClientScript(await readFile(file, 'utf8')) };
    }
    return {
      status,
      headers: { 'Content-Type': type === false ? 'application/octet-stream' : type },
      body: await readFile(file),
    };
  };

  // Every miss is answered with the site's own 404 page when it has one, so
  // the author sees the page their visitors see.
  const notFound = async (): Promise<Answer> => {
    const page = join(destination, '404.html');
    const stats = await stat(page).catch(() => undefined);
    if (stats?.isFile()) {
      return readAnswer(404, page);
    }
    return { status: 404, headers: text, body: 'Not found' };
  };

  const find = async (): Promise<Answer> => {
    let path: string;
    try {
      path = decodeURIComponent(rawPath);
    } catch {
      return notFound();
    }
    // The first listed glob that matches wins.
    // spec: docs/specs/configuration.md, Rewrites
    const rewrite = Object.entries(rewrites).find(([glob]) => matchGlob(path, glob));
    if (rewrite !== undefined) {
      path = rewrite[1];
    }
    // Normalizing keeps the path rooted, so no .. escapes the destination.
    path = posix.normalize(path);
    let file = join(destination, path);
    let stats = await stat(file).catch(() => undefined);
    if (stats?.isDirectory()) {
      if (!path.endsWith('/')) {
        // The raw path, since the decoded one may hold characters a header
        // cannot carry, with its leading slashes collapsed so the location
        // never reads as a protocol-relative URL. A 302 rather than a 301,
        // which a browser caches.
        const location = rawPath.replace(/^\/+/, '/');
        return { status: 302, headers: { Location: `${location}/${query}` }, body: '' };
      }
      file = join(file, 'index.html');
      stats = await stat(file).catch(() => undefined);
    }
    if (stats?.isFile()) {
      return readAnswer(200, file);
    }
    return notFound();
  };

  let answer: Answer;
  try {
    answer = await find();
  } catch (error) {
    answer = { status: 500, headers: text, body: describeError(error) };
  }
  response.writeHead(answer.status, {
    ...answer.headers,
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(answer.body),
  });
  response.end(answer.body);
};
