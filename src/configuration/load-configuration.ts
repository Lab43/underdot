// spec: docs/specs/configuration.md

import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { importDefault } from '../shared/import-default.ts';
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
  return resolveConfiguration(await importDefault(file), dirname(file));
};
