#!/usr/bin/env node
// spec: docs/specs/configuration.md, Commands

import { runCommand } from './configuration/run-command.ts';

process.exitCode = await runCommand(process.argv.slice(2));
