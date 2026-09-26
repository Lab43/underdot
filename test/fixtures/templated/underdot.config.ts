import { fixtureRenderer } from './fixture-renderer.ts';
import type { Configuration } from 'underdot';

export default { plugins: [fixtureRenderer()] } satisfies Configuration;
