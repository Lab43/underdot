// spec: docs/specs/build.md, Output

import { basename } from 'node:path';
import { styleText } from 'node:util';

/**
 * Where every line Underdot prints goes: the URLs a session serves, a
 * configuration reloaded, a plugin's warning, a failure's report, and a
 * build that finished.
 */
export interface Reporter {
  serving: (url: string, networkUrl: string | undefined) => void;
  reloaded: (configurationFile: string) => void;
  warned: (unit: string, pluginName: string, message: string) => void;
  failed: (report: string) => void;
  built: (milliseconds: number) => void;
}

/**
 * Bind a reporter that styles each line for the stream it is written to, so
 * color appears on a terminal only, and that starts each report with the
 * local time when asked.
 */
export const bindReporter = ({ timestamps }: { timestamps: boolean }): Reporter => {
  // A report is one write, its later lines included, so lines from two
  // reports never interleave.
  const write = (stream: NodeJS.WriteStream, report: string): void => {
    if (!timestamps) {
      stream.write(`${report}\n`);
      return;
    }
    // spec: docs/specs/dev-server.md, Terminal
    const now = new Date();
    const parts = [now.getHours(), now.getMinutes(), now.getSeconds()];
    const time = parts.map((part) => String(part).padStart(2, '0')).join(':');
    stream.write(`${styleText('dim', time, { stream })} ${report}\n`);
  };

  return {
    // spec: docs/specs/dev-server.md, Terminal
    serving: (url, networkUrl) => {
      const stream = process.stdout;
      write(stream, `Serving ${styleText('cyan', url, { stream })}`);
      if (networkUrl !== undefined) {
        write(stream, `Network ${styleText('cyan', networkUrl, { stream })}`);
      }
    },
    // spec: docs/specs/dev-server.md, Terminal
    reloaded: (configurationFile) => {
      write(process.stdout, `Reloaded ${basename(configurationFile)}`);
    },
    // spec: docs/specs/plugins.md, Errors
    warned: (unit, pluginName, message) => {
      const stream = process.stderr;
      write(stream, `${styleText('yellow', `! ${unit} warned in ${pluginName}:`, { stream })} ${message}`);
    },
    failed: (report) => {
      const stream = process.stderr;
      const [firstLine = '', ...laterLines] = report.split('\n');
      write(stream, [styleText('red', `✗ ${firstLine}`, { stream }), ...laterLines].join('\n'));
    },
    built: (milliseconds) => {
      const stream = process.stdout;
      // Rounded first, so 999.6 reads as a second rather than as 1000 ms.
      const rounded = Math.round(milliseconds);
      const duration = rounded < 1000 ? `${String(rounded)} ms` : `${(rounded / 1000).toFixed(1)} s`;
      write(stream, styleText('green', `✓ Built in ${duration}`, { stream }));
    },
  };
};
