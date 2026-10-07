// spec: docs/specs/templates.md, Data files

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extname } from 'node:path/posix';
import type { FileTable } from '../build/hash-files.ts';
import { mapUnits } from '../build/map-units.ts';
import { reuseUnit } from '../build/reuse-unit.ts';
import type { InputKind, UnitRecords, Version } from '../build/reuse-unit.ts';
import { attributeError } from '../shared/attribute-error.ts';
import { importDefault } from '../shared/import-default.ts';

/**
 * One global a data file or a data directory defines, with the path of
 * whichever defines it.
 */
export interface DataVariable {
  name: string;
  sourcePath: string;
  value: unknown;
}

// A data file once read: the directories under `_data` that hold it, its
// name without the extension, and its value.
interface DataFile {
  sourcePath: string;
  directories: string[];
  name: string;
  value: unknown;
}

const dataDirectory = '_data';
const extensions = ['.json', '.js', '.ts'];

const parseJson = (sourcePath: string, text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw attributeError(sourcePath, error);
  }
};

const importValue = async (file: string, sourcePath: string, version: string | undefined): Promise<unknown> => {
  const value = await importDefault(file, version);
  if (value === undefined) {
    throw new Error(`The data file ${sourcePath} has no default export.`);
  }
  return value;
};

// The extension and reserved-name rules are properties of the path, so they
// run before the read. The read is reused while the file's hash stands.
// spec: docs/specs/build.md, Incremental builds
const readDataFile = async (source: string, sourcePath: string, files: FileTable, records: UnitRecords<unknown>): Promise<DataFile> => {
  const extension = extname(sourcePath);
  if (!extensions.includes(extension)) {
    throw new Error(`The data file ${sourcePath} must be a .json, .js, or .ts file.`);
  }
  const segments = sourcePath.slice(dataDirectory.length + 1, -extension.length).split('/');
  const reserved = segments.findIndex((segment) => segment.startsWith('_'));
  if (reserved !== -1) {
    const variable = segments.slice(0, reserved + 1).join('.');
    throw new Error(`The data variable ${variable} from ${sourcePath} starts with an underscore, which is reserved.`);
  }
  const file = join(source, sourcePath);
  const lookup = (_kind: InputKind, name: string): Version => files.get(name)?.hash;
  const value = await reuseUnit(records, sourcePath, lookup, async (observe) => {
    observe('file', sourcePath);
    if (extension === '.json') {
      return parseJson(sourcePath, await readFile(file, 'utf8'));
    }
    // A module is imported under its hash, so an edited module loads afresh.
    return importValue(file, sourcePath, files.get(sourcePath)?.hash);
  });
  return { sourcePath, directories: segments.slice(0, -1), name: segments.slice(-1).join(''), value };
};

export const readData = async (source: string, sourcePaths: string[], files: FileTable, records: UnitRecords<unknown>): Promise<DataVariable[]> => {
  const dataPaths = sourcePaths.filter((sourcePath) => sourcePath.startsWith(`${dataDirectory}/`));
  const dataFiles = await mapUnits(dataPaths, (sourcePath) => readDataFile(source, sourcePath, files, records));

  const variables: DataVariable[] = [];
  // Every file and directory seen so far, keyed by its path without the
  // extension, so a file and a directory with one name share a key. A
  // directory's object is kept so later files can land in it.
  const definers = new Map<string, string>();
  const directories = new Map<string, Record<string, unknown>>();
  const define = (entries: Record<string, unknown> | undefined, name: string, sourcePath: string, value: unknown): void => {
    if (entries === undefined) {
      variables.push({ name, sourcePath, value });
    } else {
      entries[name] = value;
    }
  };

  for (const file of dataFiles) {
    let path = dataDirectory;
    let entries: Record<string, unknown> | undefined;
    for (const [index, segment] of file.directories.entries()) {
      path = `${path}/${segment}`;
      const definer = definers.get(path);
      let directory = directories.get(path);
      if (definer !== undefined && directory === undefined) {
        throw new Error(`Both ${definer} and the directory ${path} define ${file.directories.slice(0, index + 1).join('.')}.`);
      }
      if (directory === undefined) {
        directory = {};
        definers.set(path, path);
        directories.set(path, directory);
        define(entries, segment, path, directory);
      }
      entries = directory;
    }
    path = `${path}/${file.name}`;
    const definer = definers.get(path);
    const variable = [...file.directories, file.name].join('.');
    if (definer !== undefined) {
      throw new Error(directories.has(path)
        ? `Both ${file.sourcePath} and the directory ${path} define ${variable}.`
        : `Both ${definer} and ${file.sourcePath} define ${variable}.`);
    }
    definers.set(path, file.sourcePath);
    define(entries, file.name, file.sourcePath, file.value);
  }
  return variables;
};
