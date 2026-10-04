// spec: docs/specs/configuration.md, Programmatic use

import { build as buildSite } from './build/build.ts';
import { resolveConfiguration } from './configuration/resolve-configuration.ts';
import type { Configuration } from './configuration/resolve-configuration.ts';
import type { RenderContext } from './plugins/bind-render-context.ts';
import type { Plugin, Renderer } from './plugins/register-plugins.ts';

export type { Configuration, Plugin, RenderContext, Renderer };

/**
 * Resolve the configuration a script passes, then build it.
 * Resolving first fails a bad configuration before any work starts.
 */
export const build = async (configuration: Configuration, projectDirectory = process.cwd()): Promise<void> => {
  await buildSite(resolveConfiguration(configuration, projectDirectory));
};
