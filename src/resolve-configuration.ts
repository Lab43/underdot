// spec: docs/specs/configuration.md

import { isAbsolute, relative, resolve, sep } from 'node:path';

export interface Configuration {
  source?: string;
  destination?: string;
  exclude?: string[];
}

export interface ResolvedConfiguration {
  projectDirectory: string;
  source: string;
  destination: string;
  exclude: string[];
}

// Every setting the configuration knows, held to the type's keys in both
// directions so the unknown-setting check cannot drift from the type.
const settingNames = { source: true, destination: true, exclude: true } satisfies Record<keyof Configuration, true>;
const settings: ReadonlySet<string> = new Set(Object.keys(settingNames));

const defaults: Required<Configuration> = {
  source: 'source',
  destination: 'build',
  exclude: ['**/.DS_Store'],
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

// Whether the child is strictly inside the parent: neither the parent itself
// nor anything outside it. Both paths are absolute.
const isInside = (child: string, parent: string): boolean => {
  const path = relative(parent, child);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};

// Validate the source and destination locations.
// spec: docs/specs/build.md
const checkPlacement = (projectDirectory: string, source: string, destination: string): void => {
  if (!isInside(destination, projectDirectory)) {
    throw new Error(`The destination ${destination} must be inside the project directory ${projectDirectory}.`);
  }
  if (destination === source) {
    throw new Error(`The destination and the source root must differ, but both are ${destination}.`);
  }
  if (isInside(destination, source)) {
    throw new Error(`The destination ${destination} must not be inside the source root ${source}.`);
  }
  if (isInside(source, destination)) {
    throw new Error(`The source root ${source} must not be inside the destination ${destination}.`);
  }
};

export const resolveConfiguration = (configuration: unknown, projectDirectory: string): ResolvedConfiguration => {
  if (!isObject(configuration)) {
    throw new Error('The configuration must be an object.');
  }
  const unknown = Object.keys(configuration).filter((name) => !settings.has(name));
  if (unknown.length > 0) {
    const noun = unknown.length === 1 ? 'setting' : 'settings';
    throw new Error(`Unknown ${noun}: ${unknown.join(', ')}.`);
  }

  if (configuration.source !== undefined && typeof configuration.source !== 'string') {
    throw new Error('The source setting must be a string.');
  }
  if (configuration.destination !== undefined && typeof configuration.destination !== 'string') {
    throw new Error('The destination setting must be a string.');
  }
  if (configuration.exclude !== undefined && !isStringArray(configuration.exclude)) {
    throw new Error('The exclude setting must be an array of strings.');
  }

  const source = resolve(projectDirectory, configuration.source ?? defaults.source);
  const destination = resolve(projectDirectory, configuration.destination ?? defaults.destination);
  const exclude = configuration.exclude ?? [...defaults.exclude];

  checkPlacement(projectDirectory, source, destination);

  return { projectDirectory, source, destination, exclude };
};
