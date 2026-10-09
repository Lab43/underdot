// spec: q-docs/specs/plugins.md

import { hash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Source paths are posix whatever the platform, and only the disk read
// takes a platform path.
import { dirname, join as joinPosix } from 'node:path/posix';
import { serialize } from 'node:v8';
import type { Reporter } from '../build/bind-reporter.ts';
import type { FileTable } from '../build/hash-files.ts';
import type { Observe } from '../build/reuse-unit.ts';
import { describeError } from '../shared/describe-error.ts';
import { isPlainPath } from '../shared/is-plain-path.ts';
import type { Output } from './handle-files.ts';
import type { ProducerContext } from './produce-files.ts';
import type { RegisteredHelper } from './register-plugins.ts';

/**
 * A throw from a helper, tagged with the plugin the helper belongs to. The
 * message is the throw's own, and the throw is the cause.
 */
export class PluginError extends Error {
  readonly pluginName: string;

  constructor(pluginName: string, cause: unknown) {
    super(describeError(cause), { cause });
    this.pluginName = pluginName;
  }
}

/**
 * Makes an emitted file's contents, as text or bytes, from what it reads
 * through its context.
 */
export type Producer = (context: ProducerContext) => Promise<string | Uint8Array>;

/**
 * A file a helper handed the build to produce: the plugin and the file that
 * emitted it, where it goes, the SHA-256 of its serialized parameters, and
 * its producer.
 */
export interface EmittedFile {
  pluginName: string;
  sourcePath: string;
  outputPath: string;
  parametersHash: string;
  produce: Producer;
}

/**
 * What a renderer or helper receives for the file being rendered, the page's
 * path during its render and the template's during a template's.
 */
export interface RenderContext {
  sourcePath: string;
  /**
   * The merged variables, with every registered helper among them under its
   * name, bound to this context.
   */
  variables: Record<string, unknown>;
  /**
   * The text of the file a reference names, a path relative to this file or
   * absolute from the source root, or no value when no file is there.
   */
  readFile: (reference: string) => string | undefined;
  /**
   * The handled output at the path a reference names, resolved as a file read
   * is, or no value when no static file's output is there. The bytes are the
   * ones the build writes, so a reader never changes them.
   */
  readOutput: (reference: string) => Buffer | undefined;
  /**
   * Another page's rendered body, by its URL. Only a template may read one.
   */
  readBody: (url: string) => string;
  /**
   * The context of a file this renderer renders in place of this one, a
   * partial, with this file's variables and the data given layered over them.
   * A reference no file is at is an error, since a renderer enters a file it
   * has already read.
   */
  enterFile: (reference: string, data: Record<string, unknown>) => RenderContext;
  /**
   * Hand the build a file to produce at an output path. The path and the
   * parameters identify the file, and the producer runs after the renders,
   * only when either or what it read changed. Only a helper may emit.
   */
  emit: (outputPath: string, parameters: unknown, produce: Producer) => void;
  /**
   * Print a warning naming the render and the plugin whose function warned:
   * the helper's in a helper, the renderer's otherwise. The build goes on.
   */
  warn: (message: string) => void;
}

/**
 * Makes the context for one file. The bodies are those rendered so far, and
 * none while a page's own body renders. Every read through the context, the
 * variables included, is reported to `observe` as an input of the render,
 * and every file a helper emits is pushed onto `emits`. A warning names the
 * attribution's unit, and its plugin unless a helper warned.
 */
export type MakeRenderContext = (
  sourcePath: string,
  variables: Record<string, unknown>,
  bodies: ReadonlyMap<string, string> | undefined,
  observe: Observe,
  emits: EmittedFile[],
  attribution: { unit: string; pluginName: string },
) => RenderContext;

/**
 * Bind what the build lends every render. The result makes a context per file.
 */
// spec: q-docs/specs/build.md, Incremental builds
export const bindRenderContext = (
  source: string,
  files: FileTable,
  helpers: ReadonlyMap<string, RegisteredHelper>,
  outputs: Output[],
  reporter: Reporter,
): MakeRenderContext => {
  // The last output of a path, the only one there is once the write succeeds.
  const outputsByPath = new Map(outputs.map((output) => [output.outputPath, output]));
  const makeContext: MakeRenderContext = (sourcePath, variables, bodies, observe, emits, attribution) => {
    // A relative reference resolves against the file's directory and an
    // absolute one against the source root.
    // spec: q-docs/specs/templates.md, Relative paths
    const resolve = (reference: string): string => {
      const referencedPath = joinPosix(reference.startsWith('/') ? '.' : dirname(sourcePath), reference);
      if (referencedPath === '..' || referencedPath.startsWith('../')) {
        throw new Error(`${sourcePath} reads ${reference}, which is above the source root.`);
      }
      return referencedPath;
    };

    // An absent file is an input too, one that changes when the file appears.
    const readFile = (reference: string): string | undefined => {
      const referencedPath = resolve(reference);
      observe('file', referencedPath);
      // A file the walk did not see, an excluded one among them, is absent.
      // spec: q-docs/specs/configuration.md, Excluded files
      if (!files.has(referencedPath)) {
        return undefined;
      }
      return readFileSync(join(source, referencedPath), 'utf8');
    };

    const readOutput = (reference: string): Buffer | undefined => {
      const outputPath = resolve(reference);
      observe('output', outputPath);
      const output = outputsByPath.get(outputPath);
      if (output === undefined) {
        return undefined;
      }
      return output.contents ?? readFileSync(join(source, output.sourcePath));
    };

    const readBody = (url: string): string => {
      if (bodies === undefined) {
        throw new Error(`${sourcePath} reads the body of ${url} while its own body renders, which only a template can do.`);
      }
      observe('body', url);
      const body = bodies.get(url);
      if (body === undefined) {
        throw new Error(`${sourcePath} reads the body of ${url}, but no page has that URL.`);
      }
      return body;
    };

    const enterFile = (reference: string, data: Record<string, unknown>): RenderContext => {
      const referencedPath = resolve(reference);
      if (!files.has(referencedPath)) {
        throw new Error(`${sourcePath} enters ${reference}, but no file is there.`);
      }
      // The partial's variables: the data, and beneath it this file's
      // variables, looked up in that order rather than merged into one object,
      // so a read below the data still reaches this file's proxy. The data is
      // copied only so that a write lands on the copy.
      const below = context.variables;
      const over = { ...data };
      const layered = new Proxy(over, {
        has: (target, key) => Object.hasOwn(target, key) || Object.hasOwn(below, key),
        get: (target, key): unknown => (Object.hasOwn(target, key) ? Reflect.get(target, key) : Reflect.get(below, key)),
        getOwnPropertyDescriptor: (target, key) => {
          const own = Reflect.getOwnPropertyDescriptor(target, key);
          if (own !== undefined) {
            return own;
          }
          // A proxy may not report a property its target lacks as non-configurable.
          const descriptor = Reflect.getOwnPropertyDescriptor(below, key);
          return descriptor === undefined ? undefined : { ...descriptor, configurable: true };
        },
        ownKeys: (target) => [...Reflect.ownKeys(target), ...Reflect.ownKeys(below).filter((key) => !Object.hasOwn(target, key))],
        // A write goes to the copy. Passed the receiver, Reflect.set would
        // consult the descriptor trap above and define a non-writable property.
        set: (target, key, value) => Reflect.set(target, key, value),
      });
      return makeContext(referencedPath, layered, bodies, observe, emits, attribution);
    };

    // A throw is tagged with the helper's plugin. An engine rethrows the same
    // object with the file and line added, so the tag survives its rewrite.
    // spec: q-docs/specs/plugins.md, Errors
    const boundHelpers = new Map<string, (...args: unknown[]) => unknown>();
    for (const [name, { pluginName, helper }] of helpers) {
      // An emit is the helper's plugin's, so the build knows whose handlers
      // follow it. The parameters are hashed here, so a value the build cannot
      // compare fails on the line that emitted it.
      const emit = (outputPath: string, parameters: unknown, produce: Producer): void => {
        if (!isPlainPath(outputPath)) {
          throw new Error(`${sourcePath} emits ${JSON.stringify(outputPath)}, which is not a plain path under the destination.`);
        }
        if (typeof produce !== 'function') {
          throw new Error(`${sourcePath} emits ${outputPath} with a producer that is not a function.`);
        }
        let serialized: Buffer;
        try {
          serialized = serialize(parameters);
        } catch (error) {
          throw new Error(`${sourcePath} emits ${outputPath} with parameters the build cannot serialize: ${describeError(error)}`, { cause: error });
        }
        emits.push({ pluginName, sourcePath, outputPath, parametersHash: hash('sha256', serialized, 'hex'), produce });
      };
      const warn = (message: string): void => {
        reporter.warned(attribution.unit, pluginName, message);
      };
      boundHelpers.set(name, (...args: unknown[]): unknown => {
        try {
          return helper({ ...context, emit, warn }, ...args);
        } catch (error) {
          throw error instanceof PluginError ? error : new PluginError(pluginName, error);
        }
      });
    }
    // The object handed in, behind a proxy that answers a helper first and
    // records every named read. A write passes no receiver: with one, the
    // descriptor trap makes a helper's name look present and the write defines
    // a hidden, locked property.
    const context: RenderContext = {
      sourcePath,
      variables: new Proxy(variables, {
        get: (target, key, receiver): unknown => {
          if (typeof key === 'symbol') {
            return Reflect.get(target, key, receiver);
          }
          const helper = boundHelpers.get(key);
          if (helper !== undefined) {
            return helper;
          }
          observe('global', key);
          return Reflect.get(target, key, receiver);
        },
        has: (target, key) => {
          if (typeof key === 'symbol') {
            return Reflect.has(target, key);
          }
          if (boundHelpers.has(key)) {
            return true;
          }
          observe('global', key);
          return Reflect.has(target, key);
        },
        getOwnPropertyDescriptor: (target, key) => {
          if (typeof key === 'symbol') {
            return Reflect.getOwnPropertyDescriptor(target, key);
          }
          const helper = boundHelpers.get(key);
          if (helper !== undefined) {
            return { value: helper, writable: true, enumerable: true, configurable: true };
          }
          observe('global', key);
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        ownKeys: (target) => {
          observe('globals', '');
          const keys = Reflect.ownKeys(target);
          return [...keys, ...boundHelpers.keys().filter((name) => !Object.hasOwn(target, name))];
        },
        set: (target, key, value) => Reflect.set(target, key, value),
      }),
      readFile,
      readOutput,
      readBody,
      enterFile,
      // Only the copy a helper receives can emit.
      emit: (outputPath) => {
        throw new Error(`${sourcePath} emits ${outputPath} outside a helper, which only a helper can do.`);
      },
      warn: (message) => {
        reporter.warned(attribution.unit, attribution.pluginName, message);
      },
    };
    return context;
  };
  return makeContext;
};
