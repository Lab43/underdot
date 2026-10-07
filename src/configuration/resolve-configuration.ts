// spec: docs/specs/configuration.md

import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { Plugin } from '../plugins/register-plugins.ts';
import { isObject } from '../shared/is-object.ts';

export interface Configuration {
  source?: string;
  destination?: string;
  exclude?: string[];
  plugins?: Plugin[];
  globals?: Record<string, unknown>;
  rewrites?: Record<string, string>;
}

export interface ResolvedConfiguration {
  projectDirectory: string;
  source: string;
  destination: string;
  exclude: string[];
  plugins: Plugin[];
  globals: Record<string, unknown>;
  rewrites: Record<string, string>;
}

// Every setting the configuration knows, held to the type's keys in both
// directions so the unknown-setting check cannot drift from the type.
const settingNames = { source: true, destination: true, exclude: true, plugins: true, globals: true, rewrites: true } satisfies Record<keyof Configuration, true>;
const settings: ReadonlySet<string> = new Set(Object.keys(settingNames));

const defaults: Required<Configuration> = {
  source: 'source',
  destination: 'build',
  exclude: ['**/.DS_Store'],
  plugins: [],
  globals: {},
  rewrites: {},
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isPlugin = (value: unknown): value is Plugin => isObject(value) && typeof value.name === 'string';

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

type SettingsCheck = (configuration: Record<string, unknown>) => asserts configuration is Record<string, unknown> & Configuration;

// Check that every setting is known and has its shape.
const checkSettings: SettingsCheck = (configuration) => {
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
  if (configuration.plugins !== undefined && !Array.isArray(configuration.plugins)) {
    throw new Error('The plugins setting must be an array.');
  }
  if (configuration.plugins !== undefined && !configuration.plugins.every(isPlugin)) {
    throw new Error('Each plugin must be an object with a name.');
  }
  if (configuration.globals !== undefined && !isObject(configuration.globals)) {
    throw new Error('The globals setting must be an object.');
  }
  if (configuration.globals !== undefined) {
    const reserved = Object.keys(configuration.globals).find((name) => name.startsWith('_'));
    if (reserved !== undefined) {
      throw new Error(`The global ${reserved} starts with an underscore, which is reserved.`);
    }
  }
  if (configuration.rewrites !== undefined && !isObject(configuration.rewrites)) {
    throw new Error('The rewrites setting must be an object.');
  }
  if (configuration.rewrites !== undefined) {
    // A request path starts with a slash, so a glob without one matches
    // nothing and a path without one names nothing under the destination.
    // spec: docs/specs/configuration.md, Rewrites
    for (const [glob, path] of Object.entries(configuration.rewrites)) {
      if (typeof path !== 'string') {
        throw new Error(`The rewrite for ${glob} must be a string.`);
      }
      if (!glob.startsWith('/')) {
        throw new Error(`The rewrite glob ${glob} must start with a slash.`);
      }
      if (!path.startsWith('/')) {
        throw new Error(`The rewrite path ${path} for ${glob} must start with a slash.`);
      }
    }
  }
};

export const resolveConfiguration = (configuration: unknown, projectDirectory: string): ResolvedConfiguration => {
  if (!isObject(configuration)) {
    throw new Error('The configuration must be an object.');
  }
  checkSettings(configuration);

  const source = resolve(projectDirectory, configuration.source ?? defaults.source);
  const destination = resolve(projectDirectory, configuration.destination ?? defaults.destination);
  const exclude = configuration.exclude ?? [...defaults.exclude];
  const plugins = configuration.plugins ?? [...defaults.plugins];
  const globals = configuration.globals ?? { ...defaults.globals };
  const rewrites = configuration.rewrites ?? { ...defaults.rewrites };

  checkPlacement(projectDirectory, source, destination);

  return { projectDirectory, source, destination, exclude, plugins, globals, rewrites };
};
