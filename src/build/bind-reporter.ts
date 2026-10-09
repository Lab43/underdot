// spec: q-docs/specs/build.md, Output

import { basename } from 'node:path';
import { styleText } from 'node:util';
import type { BuildCounts } from './bind-build.ts';
import type { ChangedInput, InputKind } from './reuse-unit.ts';

/**
 * Where every line Underdot prints goes: the URLs a session serves, a
 * configuration reloaded, a plugin's warning, a failure's report, a build
 * that finished with its counts, each unit that ran or was reused, and each
 * file written to or removed from the destination.
 */
export interface Reporter {
  serving: (url: string, networkUrl: string | undefined) => void;
  reloaded: (configurationFile: string) => void;
  warned: (unit: string, pluginName: string, message: string) => void;
  failed: (report: string) => void;
  built: (milliseconds: number, counts: BuildCounts) => void;
  ran: (unit: string, changes: ChangedInput[]) => void;
  reused: (unit: string) => void;
  wrote: (outputPath: string) => void;
  removed: (outputPath: string) => void;
}

// How a changed input reads in a verbose unit line, by its kind.
const describeChange: Record<InputKind, (change: ChangedInput) => string> = {
  file: ({ name, status }) => `${name} ${status}`,
  output: ({ name, status }) => `output ${name} ${status}`,
  body: ({ name, status }) => `body of ${name} ${status}`,
  global: ({ name, status }) => `global ${name} ${status}`,
  globals: () => 'globals changed',
  chain: () => 'template chain changed',
  pages: () => 'pages changed',
  parameters: () => 'parameters changed',
};

/**
 * Bind a reporter that styles each line for the stream it is written to, so
 * color appears on a terminal only, that starts each report with the local
 * time when asked, and that lists the units that ran and the destination's
 * writes and removals only when verbose.
 */
export const bindReporter = ({ timestamps, verbose }: { timestamps: boolean; verbose: boolean }): Reporter => {
  // A report is one write, its later lines included, so lines from two
  // reports never interleave.
  const write = (stream: NodeJS.WriteStream, report: string): void => {
    if (!timestamps) {
      stream.write(`${report}\n`);
      return;
    }
    // spec: q-docs/specs/dev-server.md, Terminal
    const now = new Date();
    const parts = [now.getHours(), now.getMinutes(), now.getSeconds()];
    const time = parts.map((part) => String(part).padStart(2, '0')).join(':');
    stream.write(`${styleText('dim', time, { stream })} ${report}\n`);
  };

  return {
    // spec: q-docs/specs/dev-server.md, Terminal
    serving: (url, networkUrl) => {
      const stream = process.stdout;
      write(stream, `Serving ${styleText('cyan', url, { stream })}`);
      if (networkUrl !== undefined) {
        write(stream, `Network ${styleText('cyan', networkUrl, { stream })}`);
      }
    },
    // spec: q-docs/specs/dev-server.md, Terminal
    reloaded: (configurationFile) => {
      write(process.stdout, `Reloaded ${basename(configurationFile)}`);
    },
    // spec: q-docs/specs/plugins.md, Errors
    warned: (unit, pluginName, message) => {
      const stream = process.stderr;
      write(stream, `${styleText('yellow', `! ${unit} warned in ${pluginName}:`, { stream })} ${message}`);
    },
    failed: (report) => {
      const stream = process.stderr;
      const [firstLine = '', ...laterLines] = report.split('\n');
      write(stream, [styleText('red', `✗ ${firstLine}`, { stream }), ...laterLines].join('\n'));
    },
    built: (milliseconds, { ran, reused }) => {
      const stream = process.stdout;
      // Rounded first, so 999.6 reads as a second rather than as 1000 ms.
      const rounded = Math.round(milliseconds);
      const duration = rounded < 1000 ? `${String(rounded)} ms` : `${(rounded / 1000).toFixed(1)} s`;
      const summary = reused === 0 ? `${String(ran)} ran` : `${String(ran)} ran, ${String(reused)} reused`;
      const result = styleText('green', `✓ Built in ${duration}`, { stream });
      write(stream, `${result}${styleText('dim', ` · ${summary}`, { stream })}`);
    },
    ran: (unit, changes) => {
      if (!verbose) {
        return;
      }
      const stream = process.stdout;
      if (changes.length === 0) {
        write(stream, `  ${unit}`);
        return;
      }
      const reasons = changes.map((change) => describeChange[change.kind](change)).join(', ');
      write(stream, `  ${unit}${styleText('dim', ` · ${reasons}`, { stream })}`);
    },
    reused: () => {
      // Counted on the Built line and never listed.
    },
    wrote: (outputPath) => {
      if (verbose) {
        write(process.stdout, `  Wrote ${outputPath}`);
      }
    },
    removed: (outputPath) => {
      if (verbose) {
        write(process.stdout, `  Removed ${outputPath}`);
      }
    },
  };
};
