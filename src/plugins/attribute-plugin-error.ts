// spec: docs/specs/plugins.md, Errors

import { describeError } from '../shared/describe-error.ts';

/**
 * An error naming the unit that failed and the plugin it failed in, with the
 * plugin's own message as it is and the original as its cause.
 */
export const attributePluginError = (unit: string, pluginName: string, error: unknown): Error =>
  new Error(`${unit} failed in ${pluginName}: ${describeError(error)}`, { cause: error });
