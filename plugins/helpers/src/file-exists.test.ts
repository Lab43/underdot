// spec: docs/specs/helpers.md

import type { RenderContext } from 'underdot';
import { describe, expect, test, vi } from 'vitest';
import { fileExists } from './file-exists.ts';

// The context as the spec defines it to a helper, with a read of handled
// output answering from a map by the reference as written.
const makeContext = (outputs: Record<string, string>) => {
  const readOutput = vi.fn((reference: string): Buffer | undefined => {
    const output = outputs[reference];
    return output === undefined ? undefined : Buffer.from(output);
  });
  const context: RenderContext = {
    sourcePath: 'blog/_post.ejs',
    variables: {},
    readFile: () => undefined,
    readOutput,
    readBody: () => '',
    enterFile: () => context,
  };
  return { context, readOutput };
};

describe('fileExists', () => {
  test('a reference an output is at is present, read as written', () => {
    const { context, readOutput } = makeContext({ 'cover.svg': '<svg/>' });
    expect(fileExists(context, 'cover.svg')).toBe(true);
    expect(readOutput).toHaveBeenCalledExactlyOnceWith('cover.svg');
  });

  test('a reference no output is at is absent', () => {
    const { context } = makeContext({});
    expect(fileExists(context, '/styles/print.css')).toBe(false);
  });

  test('a reference that is not a string fails before anything is read', () => {
    const { context, readOutput } = makeContext({});
    expect(() => fileExists(context, 42)).toThrow(new Error('The reference must be a string, and 42 is not.'));
    expect(readOutput).not.toHaveBeenCalled();
  });

  test("the context's own error propagates as it is", () => {
    const error = new Error('blog/_post.ejs reads /../x, which is above the source root.');
    const { context, readOutput } = makeContext({});
    readOutput.mockImplementation(() => { throw error; });
    expect(() => fileExists(context, '/../x')).toThrow(error);
  });
});
