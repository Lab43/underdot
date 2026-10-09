// Every test process, and every process a test spawns, starts with color
// neither forced nor disabled, whatever the developer's environment holds.
delete process.env.FORCE_COLOR;
delete process.env.NO_COLOR;
