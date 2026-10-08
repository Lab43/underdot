// spec: docs/specs/plugins.md, Errors

/**
 * Print a plugin's warning to standard error, naming the unit that was
 * running and the plugin that warned. The build goes on.
 */
export const printWarning = (unit: string, pluginName: string, message: string): void => {
  process.stderr.write(`${unit} warned in ${pluginName}: ${message}\n`);
};
