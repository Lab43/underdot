import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = fileURLToPath(new URL('../fixtures/', import.meta.url));

// The absolute path of a fixture, or of a path inside one.
export const fixturePath = (...segments: string[]): string => join(fixtures, ...segments);
