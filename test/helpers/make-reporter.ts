import { vi } from 'vitest';
import type { Reporter } from '../../src/build/bind-reporter.ts';

// A reporter that prints nothing and records every call.
export const makeReporter = (): Reporter => ({
  serving: vi.fn(),
  reloaded: vi.fn(),
  warned: vi.fn(),
  failed: vi.fn(),
  built: vi.fn(),
  ran: vi.fn(),
  reused: vi.fn(),
  wrote: vi.fn(),
  removed: vi.fn(),
});
