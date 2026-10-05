// spec: docs/specs/bust.md

import type { RenderContext } from 'underdot';
import { describe, expect, test, vi } from 'vitest';
import { bustReference } from './bust-reference.ts';

// The context as the spec defines it to a helper: the file being rendered, and
// a read of handled output answering from a map by the reference as written.
const makeContext = (sourcePath: string, outputs: Record<string, string>) => {
  const readOutput = vi.fn((reference: string): Buffer | undefined => {
    const output = outputs[reference];
    return output === undefined ? undefined : Buffer.from(output);
  });
  const context: RenderContext = {
    sourcePath,
    variables: {},
    readFile: () => undefined,
    readOutput,
    readBody: () => '',
    enterFile: () => context,
  };
  return { context, readOutput };
};

const collapsed = 'body { margin: 0; }\n';

describe('bustReference', () => {
  test('an absolute reference returns the output path with eight hex characters of its SHA-256', () => {
    const { context } = makeContext('index.ejs', { '/styles/site.css': collapsed });
    expect(bustReference(context, '/styles/site.css')).toBe('/styles/site.css?v=eac0e790');
  });

  test('an output holding other bytes gets another hash', () => {
    const { context } = makeContext('index.ejs', { '/styles/site.css': 'body {\n  margin: 0;\n}\n' });
    expect(bustReference(context, '/styles/site.css')).toBe('/styles/site.css?v=25e8ca12');
  });

  test("a relative reference resolves against the file's directory and is read as written", () => {
    const { context, readOutput } = makeContext('blog/_.ejs', { '../styles/site.css': collapsed });
    expect(bustReference(context, '../styles/site.css')).toBe('/styles/site.css?v=eac0e790');
    expect(readOutput).toHaveBeenCalledExactlyOnceWith('../styles/site.css');
  });

  test('a relative reference from the source root gets a leading slash', () => {
    const { context } = makeContext('index.ejs', { 'scripts/site.js': "export const site = 'bust';\n" });
    expect(bustReference(context, 'scripts/site.js')).toBe('/scripts/site.js?v=2aab4262');
  });

  test('a reference with a dot segment is normalized', () => {
    const { context } = makeContext('index.ejs', { '/styles/./site.css': collapsed });
    expect(bustReference(context, '/styles/./site.css')).toBe('/styles/site.css?v=eac0e790');
  });

  test.each([undefined, 42])('a reference of %j fails before anything is read', (reference) => {
    const { context, readOutput } = makeContext('index.ejs', {});
    expect(() => bustReference(context, reference)).toThrow(new Error(`A reference must be a string, and ${String(reference)} is not.`));
    expect(readOutput).not.toHaveBeenCalled();
  });

  test.each([
    ['index.ejs', '/_icons/mail.svg'],
    ['blog/_.ejs', '../_icons/mail.svg'],
    ['blog/_.ejs', '/a/../_b/c.svg'],
  ])('from %s, the private output %s cannot be linked', (sourcePath, reference) => {
    const { context } = makeContext(sourcePath, { [reference]: '<svg/>' });
    expect(() => bustReference(context, reference)).toThrow(new Error(`${reference} is private, so it is never written and cannot be linked.`));
  });

  test('a reference no output is at fails', () => {
    const { context } = makeContext('index.ejs', {});
    expect(() => bustReference(context, '/missing.css')).toThrow(new Error("No static file's output is at /missing.css."));
  });

  test("the context's own error propagates as it is", () => {
    const error = new Error('index.ejs reads /../x, which is above the source root.');
    const { context, readOutput } = makeContext('index.ejs', {});
    readOutput.mockImplementation(() => { throw error; });
    expect(() => bustReference(context, '/../x')).toThrow(error);
  });
});
