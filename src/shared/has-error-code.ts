/**
 * Whether the value is an error carrying the given code, as the errors the
 * runtime raises from the file system and the network do.
 */
export const hasErrorCode = (error: unknown, code: string): boolean =>
  error instanceof Error && 'code' in error && error.code === code;
