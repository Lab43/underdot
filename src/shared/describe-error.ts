// The message of an Error, and anything else as a string.
export const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));
