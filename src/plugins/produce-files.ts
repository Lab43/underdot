// spec: docs/specs/plugins.md, Emitted files
// spec: docs/specs/build.md, Incremental builds

import { hash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Reporter } from '../build/bind-reporter.ts';
import type { FileTable } from '../build/hash-files.ts';
import { mapUnits } from '../build/map-units.ts';
import { reuseUnit } from '../build/reuse-unit.ts';
import type { InputKind, Observe, UnitRecords, Version } from '../build/reuse-unit.ts';
import { compareStrings } from '../shared/compare-strings.ts';
import { attributePluginError } from './attribute-plugin-error.ts';
import type { EmittedFile } from './bind-render-context.ts';
import type { Output } from './handle-files.ts';
import type { RegisteredHandler } from './register-plugins.ts';
import { runHandlers } from './run-handlers.ts';

/**
 * What a producer receives: a read of a static file's handled output by its
 * output path, with no leading slash, or no value when no output is there.
 * Every read is an input of the produced file.
 */
export interface ProducerContext {
  readOutput: (outputPath: string) => Buffer | undefined;
  /**
   * Print a warning naming the emitting plugin. The build goes on.
   */
  warn: (message: string) => void;
}

/**
 * A produced file as the handlers after the emitting plugin left it. The
 * source path is the file that emits it now. No contents means the bytes
 * were dropped once written.
 */
export interface EmittedOutput {
  sourcePath: string;
  outputPath: string;
  contents: Buffer | undefined;
  hash: string;
}

/**
 * Produce every emitted file, one unit per output path, and run each through
 * the handlers of the plugins after the one that emitted it. A unit is reused
 * while its parameters and every output it read stand, and while every file
 * it produced is in memory or whole in the destination.
 */
export const produceFiles = async (
  source: string,
  destination: string,
  emits: EmittedFile[],
  handlers: RegisteredHandler[],
  pluginNames: string[],
  outputs: Output[],
  files: FileTable,
  written: ReadonlyMap<string, string>,
  records: UnitRecords<EmittedOutput[]>,
  reporter: Reporter,
): Promise<EmittedOutput[]> => {
  const outputsByPath = new Map(outputs.map((output) => [output.outputPath, output]));
  // Sorted, so a collision names its two sources the same way whichever
  // render finished first, and the first emit of a path stands for the rest.
  const orderedEmits = emits.toSorted((a, b) => compareStrings(a.outputPath, b.outputPath) || compareStrings(a.sourcePath, b.sourcePath));
  const firstEmits: EmittedFile[] = [];
  for (const emitted of orderedEmits) {
    const first = firstEmits.at(-1);
    if (first?.outputPath !== emitted.outputPath) {
      firstEmits.push(emitted);
      continue;
    }
    if (emitted.pluginName !== first.pluginName) {
      throw new Error(`Both ${first.pluginName} and ${emitted.pluginName} emit ${emitted.outputPath}.`);
    }
    if (emitted.parametersHash !== first.parametersHash) {
      if (emitted.sourcePath === first.sourcePath) {
        throw new Error(`${emitted.sourcePath} emits ${emitted.outputPath} twice with different inputs.`);
      }
      throw new Error(`Both ${first.sourcePath} and ${emitted.sourcePath} emit ${emitted.outputPath} with different inputs.`);
    }
  }
  const outputsByUnit = await mapUnits(firstEmits, async ({ pluginName, sourcePath, outputPath, parametersHash, produce }) => {
    // A file whose bytes were dropped is whole only while the destination
    // holds what the build last wrote there, so a record with one missing
    // runs again.
    const record = records.get(outputPath);
    if (record !== undefined) {
      const outputsWhole = await Promise.all(record.result.map(async (output) => {
        if (output.contents !== undefined) {
          return true;
        }
        if (written.get(output.outputPath) !== output.hash) {
          return false;
        }
        const stats = await stat(join(destination, output.outputPath)).catch(() => undefined);
        return stats?.isFile() === true;
      }));
      if (!outputsWhole.every(Boolean)) {
        records.delete(outputPath);
      }
    }
    const lookup = (kind: InputKind, name: string): Version => {
      if (kind === 'parameters') {
        return parametersHash;
      }
      if (kind === 'file') {
        return files.get(name)?.hash;
      }
      return outputsByPath.get(name)?.hash;
    };
    const run = async (observe: Observe): Promise<EmittedOutput[]> => {
      observe('parameters', '');
      const readOutput = (readPath: string): Buffer | undefined => {
        observe('output', readPath);
        const output = outputsByPath.get(readPath);
        if (output === undefined) {
          return undefined;
        }
        return output.contents ?? readFileSync(join(source, output.sourcePath));
      };
      const warn = (message: string): void => {
        reporter.warned(`Producing ${outputPath}`, pluginName, message);
      };
      let contents: unknown;
      // spec: docs/specs/plugins.md, Errors
      try {
        contents = await produce({ readOutput, warn });
      } catch (error) {
        throw attributePluginError(`Producing ${outputPath}`, pluginName, error);
      }
      if (typeof contents !== 'string' && !(contents instanceof Uint8Array)) {
        throw new Error(`The producer ${pluginName} gave for ${outputPath} must return text or bytes.`);
      }
      const index = pluginNames.indexOf(pluginName);
      const handlersAfter = handlers.filter((handler) => pluginNames.indexOf(handler.pluginName) > index);
      const bytes = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
      const handled = await runHandlers(
        outputPath,
        { outputPath, contents: bytes },
        handlersAfter,
        source,
        files,
        observe,
        reporter,
      );
      return handled.map((file) => ({ sourcePath, outputPath: file.outputPath, contents: file.contents, hash: hash('sha256', file.contents, 'hex') }));
    };
    const result = await reuseUnit(records, outputPath, lookup, run, reporter, `Produced ${outputPath}`);
    for (const output of result) {
      output.sourcePath = sourcePath;
    }
    return result;
  });
  return outputsByUnit.flat();
};
