import type { RenderContext } from '../../src/plugins/bind-render-context.ts';

// A context whose reads find nothing, whose partial is itself, and whose emit
// and warn throw, with the fields a test cares about given over them.
export const makeRenderContext = (fields: Partial<RenderContext> & { sourcePath: string }): RenderContext => {
  const context: RenderContext = {
    variables: {},
    readFile: () => undefined,
    readOutput: () => undefined,
    readBody: () => '',
    enterFile: () => context,
    emit: () => {
      throw new Error('This test never emits.');
    },
    warn: () => {
      throw new Error('This test never warns.');
    },
    ...fields,
  };
  return context;
};
