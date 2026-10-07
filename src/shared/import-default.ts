import { pathToFileURL } from 'node:url';

/**
 * The default export of the module at an absolute path, undefined when it has
 * none. A module loads once per URL, so a version in the URL loads the file
 * as it stands now.
 */
export const importDefault = async (file: string, version?: string): Promise<unknown> => {
  const url = pathToFileURL(file);
  if (version !== undefined) {
    url.searchParams.set('v', version);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- an import of a path known only at runtime is typed any
  return (await import(url.href)).default;
};
