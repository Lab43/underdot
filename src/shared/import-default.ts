import { pathToFileURL } from 'node:url';

// The default export of the module at an absolute path, undefined when it has none.
export const importDefault = async (file: string): Promise<unknown> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- an import of a path known only at runtime is typed any
  (await import(pathToFileURL(file).href)).default;
