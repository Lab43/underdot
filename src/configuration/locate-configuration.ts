// spec: q-docs/specs/configuration.md, The configuration file

import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const fileNames = ['underdot.config.ts', 'underdot.config.js'];

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const findConfigurationFile = async (directory: string): Promise<string> => {
  const present: string[] = [];
  for (const name of fileNames) {
    const path = resolve(directory, name);
    if (await exists(path)) {
      present.push(path);
    }
  }
  const [first, second] = present;
  if (first === undefined) {
    throw new Error(`No ${fileNames.join(' or ')} in ${directory}.`);
  }
  if (second !== undefined) {
    throw new Error(`Both ${first} and ${second} are present. Keep one.`);
  }
  return first;
};

const checkConfigurationFile = async (path: string): Promise<string> => {
  const file = resolve(path);
  if (!(await exists(file))) {
    throw new Error(`No configuration file at ${file}.`);
  }
  return file;
};

/**
 * The absolute path of the configuration file: the file at the given path,
 * or the one in the working directory when no path is given.
 */
export const locateConfiguration = async (path?: string): Promise<string> =>
  path === undefined ? findConfigurationFile(process.cwd()) : checkConfigurationFile(path);
