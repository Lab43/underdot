import type { HandlerContext } from '../../src/plugins/run-handlers.ts';

// A context whose declare and warn throw, with the fields a test cares about
// given over them.
export const makeHandlerContext = (fields: Partial<HandlerContext> = {}): HandlerContext => ({
  sourceDirectory: '/site/source',
  declareFile: () => {
    throw new Error('This test never declares a file.');
  },
  warn: () => {
    throw new Error('This test never warns.');
  },
  ...fields,
});
