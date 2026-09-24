// spec: docs/specs/configuration.md

import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveConfiguration } from './resolve-configuration.ts';
import type { ResolvedConfiguration } from './resolve-configuration.ts';

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

export const loadConfiguration = async (path?: string): Promise<ResolvedConfiguration> => {
  const file = path === undefined ? await findConfigurationFile(process.cwd()) : await checkConfigurationFile(path);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- an import of a path known only at runtime is typed any
  const configuration: unknown = (await import(pathToFileURL(file).href)).default;
  return resolveConfiguration(configuration, dirname(file));
};
