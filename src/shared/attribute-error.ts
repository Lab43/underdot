import { describeError } from './describe-error.ts';

// An error naming the source file it came from, with the original as its cause.
export const attributeError = (sourcePath: string, error: unknown): Error =>
  new Error(`${sourcePath}: ${describeError(error)}`, { cause: error });
