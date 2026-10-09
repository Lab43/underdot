import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'plugins/*/src/**/*.test.ts'],
    setupFiles: ['test/setup/remove-color-variables.ts'],
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      enabled: true,
      include: ['src/**', 'plugins/*/src/**'],
      exclude: ['**/*.test.ts'],
      reporter: ['text'],
      thresholds: { 100: true },
    },
  },
});
