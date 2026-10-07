// spec: docs/specs/configuration.md, Programmatic use

import { bindBuild } from './build/bind-build.ts';
import { resolveConfiguration } from './configuration/resolve-configuration.ts';
import type { Configuration } from './configuration/resolve-configuration.ts';
import { startSession } from './dev-server/start-session.ts';
import type { Session } from './dev-server/start-session.ts';
import type { Producer, RenderContext } from './plugins/bind-render-context.ts';
import type { ProducerContext } from './plugins/produce-files.ts';
import type { FileHandler, Helper, PageHook, Plugin, Renderer } from './plugins/register-plugins.ts';
import type { HandledFile, HandlerContext, HandlerOutput } from './plugins/run-handlers.ts';
import type { HookContext, HookPage } from './plugins/run-page-hooks.ts';

export type { Configuration, FileHandler, HandledFile, HandlerContext, HandlerOutput, Helper, HookContext, HookPage, PageHook, Plugin, Producer, ProducerContext, RenderContext, Renderer, Session };

/**
 * Resolve the configuration a script passes, then build it once.
 * Resolving first fails a bad configuration before any work starts.
 */
export const build = async (configuration: Configuration, projectDirectory = process.cwd()): Promise<void> => {
  await bindBuild(resolveConfiguration(configuration, projectDirectory))();
};

/**
 * Resolve the configuration a script passes, then run a session on it. The
 * session never reloads: the script owns the value, and a script that
 * changes it starts a session again.
 */
export const dev = (
  configuration: Configuration,
  options: { port?: number; https?: boolean } = {},
  projectDirectory = process.cwd(),
): Promise<Session> =>
  startSession({ load: () => Promise.resolve(resolveConfiguration(configuration, projectDirectory)), ...options });
