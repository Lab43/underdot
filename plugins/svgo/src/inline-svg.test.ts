// spec: docs/specs/svgo.md

import { describe, expect, test, vi } from 'vitest';
import { makeRenderContext } from '../../../test/helpers/make-render-context.ts';
import { inlineSvg } from './inline-svg.ts';

// The context as the spec defines it to a helper, with a read of handled
// output answering from a map by the reference as written.
const makeContext = (outputs: Record<string, string>) => {
  const readOutput = vi.fn((reference: string): Buffer | undefined => {
    const output = outputs[reference];
    return output === undefined ? undefined : Buffer.from(output);
  });
  const context = makeRenderContext({ sourcePath: 'blog/_post.ejs', readOutput });
  return { context, readOutput };
};

const icon = '<svg xmlns="http://www.w3.org/2000/svg"><title>Mail</title></svg>';

describe('inlineSvg', () => {
  test('a reference an output is at returns its text, read as written', () => {
    const { context, readOutput } = makeContext({ '/_icons/mail.svg': icon });
    expect(inlineSvg(context, '/_icons/mail.svg')).toBe(icon);
    expect(readOutput).toHaveBeenCalledExactlyOnceWith('/_icons/mail.svg');
  });

  test('a reference that is not a string fails before anything is read', () => {
    const { context, readOutput } = makeContext({});
    expect(() => inlineSvg(context, 42)).toThrow(new Error('The reference must be a string, and 42 is not.'));
    expect(readOutput).not.toHaveBeenCalled();
  });

  test('a reference no output is at fails', () => {
    const { context } = makeContext({});
    expect(() => inlineSvg(context, '/_icons/missing.svg')).toThrow(new Error("No static file's output is at /_icons/missing.svg."));
  });

  test("the context's own error propagates as it is", () => {
    const error = new Error('blog/_post.ejs reads /../x, which is above the source root.');
    const { context, readOutput } = makeContext({});
    readOutput.mockImplementation(() => { throw error; });
    expect(() => inlineSvg(context, '/../x')).toThrow(error);
  });
});
