// spec: docs/specs/configuration.md

import { dirname } from 'node:path';
import { importDefault } from '../shared/import-default.ts';
import { resolveConfiguration } from './resolve-configuration.ts';
import type { ResolvedConfiguration } from './resolve-configuration.ts';

/**
 * The configuration a file's default export holds, resolved under the
 * file's directory. A version loads the file as it stands rather than as
 * the module cache holds it, so a session can load the file again.
 */
export const loadConfiguration = async (file: string, version?: string): Promise<ResolvedConfiguration> =>
  resolveConfiguration(await importDefault(file, version), dirname(file));
